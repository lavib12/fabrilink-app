from decimal import Decimal

from django.db.models import Prefetch
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.companies.models import CompanyTypeChoices, VerificationStatusChoices
from apps.companies.selectors import get_user_primary_company
from common.exceptions import NotFoundError, PermissionDeniedError

from .models import Cart, CartItem, Order, OrderItem, OrderStatusChoices
from .serializers import (
    AddToCartSerializer,
    CartItemSerializer,
    CheckoutRequestSerializer,
    OrderDetailSerializer,
    OrderStatusUpdateSerializer,
)
from .services import (
    add_item_to_cart,
    calculate_order_fees,
    checkout_cart,
    credit_summary,
    transition_order_status,
)


def _is_operations_staff(user) -> bool:
    return bool(user.is_staff or user.role in ("ADMIN", "HUB_STAFF"))


def _get_buyer_company(user):
    company = get_user_primary_company(user.id)
    if not company or company.company_type != CompanyTypeChoices.BUYER:
        raise PermissionDeniedError("Only buyer accounts can use the cart and checkout.")
    return company


def _scoped_orders(user):
    """Return the orders the user may see, with items limited to what they may see."""
    base_items = OrderItem.objects.select_related("fabric_roll")
    if _is_operations_staff(user):
        return Order.objects.select_related("buyer").prefetch_related(
            Prefetch("items", queryset=base_items), "tracking_events"
        )

    company = get_user_primary_company(user.id)
    if not company:
        return Order.objects.none()

    if company.company_type == CompanyTypeChoices.FACTORY:
        # A factory only sees its own line items, not what the buyer bought from other mills.
        return (
            Order.objects.filter(items__fabric_roll__factory=company)
            .distinct()
            .select_related("buyer")
            .prefetch_related(
                Prefetch("items", queryset=base_items.filter(fabric_roll__factory=company)),
                "tracking_events",
            )
        )

    return (
        Order.objects.filter(buyer=company)
        .select_related("buyer")
        .prefetch_related(Prefetch("items", queryset=base_items), "tracking_events")
    )


class CartView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(responses={200: CartItemSerializer(many=True)})
    def get(self, request):
        company = get_user_primary_company(request.user.id)
        if not company or company.company_type != CompanyTypeChoices.BUYER:
            return Response({"success": True, "data": {"items": [], "fees": {}}})

        cart, _ = Cart.objects.get_or_create(buyer=company)
        items = list(cart.items.select_related("fabric_roll").all())
        items_serializer = CartItemSerializer(items, many=True)

        subtotal = sum((item.requested_yards * item.unit_price for item in items), Decimal("0.00"))
        total_yards = sum((item.requested_yards for item in items), Decimal("0.00"))
        fees = calculate_order_fees(subtotal, total_yards)

        return Response(
            {
                "success": True,
                "data": {
                    "items": items_serializer.data,
                    "fees": {k: str(v) for k, v in fees.items()},
                },
            }
        )

    @extend_schema(request=AddToCartSerializer, responses={201: CartItemSerializer})
    def post(self, request):
        company = _get_buyer_company(request.user)

        serializer = AddToCartSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        cart_item = add_item_to_cart(
            buyer=company,
            roll_id=str(serializer.validated_data["fabric_roll_id"]),
            requested_yards=serializer.validated_data["requested_yards"],
        )

        return Response(
            {
                "success": True,
                "message": "Fabric roll breakdown added to cart.",
                "data": CartItemSerializer(cart_item).data,
            },
            status=status.HTTP_201_CREATED,
        )


class CartItemDeleteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, item_id):
        company = get_user_primary_company(request.user.id)
        if not company:
            raise NotFoundError("Company not found.")

        item = CartItem.objects.filter(id=item_id, cart__buyer=company).first()
        if not item:
            raise NotFoundError("Cart item not found.")

        item.delete()
        return Response({"success": True, "message": "Item removed from cart."})


class CreditSummaryView(APIView):
    """Buyer's B2B credit line: limit, unsettled credit orders and what's left to spend."""

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(responses={200: OpenApiResponse(description="Credit summary")})
    def get(self, request):
        company = _get_buyer_company(request.user)
        summary = credit_summary(company)
        data = {k: str(v) if isinstance(v, Decimal) else v for k, v in summary.items()}
        return Response({"success": True, "data": data})


class CheckoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=CheckoutRequestSerializer, responses={201: OrderDetailSerializer})
    def post(self, request):
        company = _get_buyer_company(request.user)
        if company.verification_status != VerificationStatusChoices.APPROVED:
            raise PermissionDeniedError(
                "Your company's KYC verification must be approved before placing orders.",
                code="company_not_verified",
            )

        serializer = CheckoutRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        order = checkout_cart(
            buyer=company,
            payment_method=serializer.validated_data.get("payment_method", "BKASH"),
            delivery_notes=serializer.validated_data.get("delivery_notes", ""),
            item_ids=serializer.validated_data.get("item_ids"),
            actor=request.user,
        )
        order = _scoped_orders(request.user).get(id=order.id)

        return Response(
            {
                "success": True,
                "message": "Order created and payment authorized successfully.",
                "data": OrderDetailSerializer(order).data,
            },
            status=status.HTTP_201_CREATED,
        )


class OrderListView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(responses={200: OrderDetailSerializer(many=True)})
    def get(self, request):
        orders = _scoped_orders(request.user).order_by("-created_at")

        status_filter = request.query_params.get("status")
        if status_filter:
            orders = orders.filter(status=status_filter)

        serializer = OrderDetailSerializer(orders, many=True)
        return Response({"success": True, "data": serializer.data})


class OrderDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(responses={200: OrderDetailSerializer})
    def get(self, request, order_id):
        order = _scoped_orders(request.user).filter(id=order_id).first()
        if not order:
            raise NotFoundError("Order not found.")
        return Response({"success": True, "data": OrderDetailSerializer(order).data})


class OrderStatusUpdateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=OrderStatusUpdateSerializer, responses={200: OrderDetailSerializer})
    def patch(self, request, order_id):
        order = _scoped_orders(request.user).filter(id=order_id).first()
        if not order:
            raise NotFoundError("Order not found.")

        serializer = OrderStatusUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data["status"]

        # Hub staff / admins drive fulfilment. Buyers may only cancel their own order.
        if not _is_operations_staff(request.user):
            is_own_order = order.buyer.user_id == request.user.id
            if not (is_own_order and new_status == OrderStatusChoices.CANCELLED):
                raise PermissionDeniedError(
                    "You do not have permission to change this order's status."
                )

        transition_order_status(
            order_id=str(order.id),
            new_status=new_status,
            actor=request.user,
            notes=serializer.validated_data.get("notes", ""),
            location=serializer.validated_data.get("location", ""),
        )

        fresh_order = _scoped_orders(request.user).get(id=order.id)
        return Response({"success": True, "data": OrderDetailSerializer(fresh_order).data})
