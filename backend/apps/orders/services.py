from collections.abc import Iterable
from decimal import Decimal

from django.db import transaction

from apps.catalog.models import FabricRoll, RollStatusChoices
from apps.companies.models import Company, CompanyTypeChoices, CreditStatusChoices
from apps.inventory.models import StockLedger, StockTransactionTypeChoices
from common.exceptions import (
    InsufficientStockError,
    InvalidStateTransitionError,
    NotFoundError,
    PermissionDeniedError,
    RollBreakdownError,
    ValidationError,
)
from common.utils import generate_reference_code

from .models import Cart, CartItem, Order, OrderItem, OrderStatusChoices, OrderTrackingEvent

# Platform Fee Rates
COMMISSION_RATE = Decimal("0.06")  # 6% Platform commission
BASE_CUTTING_FEE = Decimal("150.00")  # ৳150 base machine cut fee
PER_YARD_CUTTING_FEE = Decimal("5.00")  # ৳5 per yard
STANDARD_DELIVERY_FEE = Decimal("120.00")  # ৳120 courier flat fee
BD_VAT_RATE = Decimal("0.15")  # 15% VAT on commission & cutting service

PURCHASABLE_ROLL_STATUSES = (RollStatusChoices.ACTIVE, RollStatusChoices.RESERVED_PARTIAL)

# Forward-only fulfilment pipeline. The hub may skip intermediate steps
# (e.g. PAID -> AT_HUB when the mill drops off directly) but never move backwards.
FULFILMENT_PIPELINE = [
    OrderStatusChoices.PAID_CREDIT_APPROVED,
    OrderStatusChoices.PICKUP_SCHEDULED,
    OrderStatusChoices.PICKED_UP,
    OrderStatusChoices.AT_HUB,
    OrderStatusChoices.CUTTING,
    OrderStatusChoices.CUT_DONE,
    OrderStatusChoices.PACKED,
    OrderStatusChoices.OUT_FOR_DELIVERY,
    OrderStatusChoices.DELIVERED,
    OrderStatusChoices.COMPLETED,
]
# Stock is only returned to the roll if the fabric hasn't been cut yet.
CANCELLABLE_STATUSES = {
    OrderStatusChoices.PAID_CREDIT_APPROVED,
    OrderStatusChoices.PICKUP_SCHEDULED,
    OrderStatusChoices.PICKED_UP,
    OrderStatusChoices.AT_HUB,
}
EXCEPTION_TRANSITIONS = {
    OrderStatusChoices.DELIVERED: {OrderStatusChoices.DISPUTED},
    OrderStatusChoices.DISPUTED: {OrderStatusChoices.REFUNDED, OrderStatusChoices.COMPLETED},
    OrderStatusChoices.CANCELLED: {OrderStatusChoices.REFUNDED},
}

STATUS_EVENT_TITLES = {
    OrderStatusChoices.PICKUP_SCHEDULED: "Pickup Scheduled from Mill",
    OrderStatusChoices.PICKED_UP: "Picked Up from Mill",
    OrderStatusChoices.AT_HUB: "Received at Central Hub & Scanned",
    OrderStatusChoices.CUTTING: "Precision Machine Cutting in Progress",
    OrderStatusChoices.CUT_DONE: "Precision Cut Completed",
    OrderStatusChoices.PACKED: "Packed & Barcode Tag Attached",
    OrderStatusChoices.OUT_FOR_DELIVERY: "Handed to Courier (Out for Delivery)",
    OrderStatusChoices.DELIVERED: "Delivered to Boutique",
    OrderStatusChoices.COMPLETED: "Completed & Settled",
    OrderStatusChoices.CANCELLED: "Order Cancelled",
    OrderStatusChoices.DISPUTED: "Dispute Raised",
    OrderStatusChoices.REFUNDED: "Refund Issued",
}


def calculate_order_fees(subtotal: Decimal, total_yards: Decimal) -> dict[str, Decimal]:
    """Calculates all itemized fees, platform commission, courier, and Bangladesh VAT."""
    if total_yards <= 0:
        zero = Decimal("0.00")
        return {
            "items_subtotal": zero,
            "platform_commission_fee": zero,
            "cutting_fee": zero,
            "delivery_fee": zero,
            "vat_tax_amount": zero,
            "total_amount": zero,
        }
    commission = (subtotal * COMMISSION_RATE).quantize(Decimal("0.01"))
    cutting = (BASE_CUTTING_FEE + (total_yards * PER_YARD_CUTTING_FEE)).quantize(Decimal("0.01"))
    delivery = STANDARD_DELIVERY_FEE
    vat = ((commission + cutting) * BD_VAT_RATE).quantize(Decimal("0.01"))
    total = (subtotal + commission + cutting + delivery + vat).quantize(Decimal("0.01"))

    return {
        "items_subtotal": subtotal.quantize(Decimal("0.01")),
        "platform_commission_fee": commission,
        "cutting_fee": cutting,
        "delivery_fee": delivery,
        "vat_tax_amount": vat,
        "total_amount": total,
    }


def validate_roll_breakdown(roll: FabricRoll, requested_yards: Decimal) -> None:
    """
    Enforces the core roll-breakdown invariants:
    1. requested_yards >= min_cut_length_yards
    2. requested_yards <= available_yards
    3. leftover must be either 0 OR >= min_cut_length_yards
    """
    min_cut = roll.min_cut_length_yards
    avail = roll.available_yards

    if requested_yards <= 0:
        raise RollBreakdownError("Requested yards must be greater than zero.")

    if requested_yards < min_cut:
        raise RollBreakdownError(
            f"The minimum cut length for this roll is {min_cut} yards. Requested: {requested_yards} yards."
        )

    if requested_yards > avail:
        raise InsufficientStockError(
            f"Requested {requested_yards} yards exceeds current available roll stock ({avail} yards)."
        )

    leftover = avail - requested_yards
    if leftover > Decimal("0.00") and leftover < min_cut:
        raise RollBreakdownError(
            f"Invalid breakdown: Cutting {requested_yards} yards leaves an unsellable remnant of {leftover} yards. "
            f"Remaining piece must be 0 yards (take whole roll) or at least {min_cut} yards."
        )


def _assert_roll_purchasable(roll: FabricRoll, buyer: Company) -> None:
    if roll.status not in PURCHASABLE_ROLL_STATUSES:
        raise RollBreakdownError("This fabric roll is not currently available for purchase.")
    if roll.target_buyer_id and roll.target_buyer_id != buyer.id:
        # Don't reveal that another buyer's private profile exists.
        raise NotFoundError("Fabric roll not found.")
    if roll.factory_id == buyer.id:
        raise ValidationError("You cannot purchase your own fabric listing.")


@transaction.atomic
def add_item_to_cart(
    *,
    buyer: Company,
    roll_id: str,
    requested_yards: Decimal,
) -> CartItem:
    """Validates breakdown constraints and adds/updates an item in the buyer's cart."""
    if buyer.company_type != CompanyTypeChoices.BUYER:
        raise PermissionDeniedError("Only buyer accounts can purchase fabric.")

    roll = FabricRoll.objects.select_for_update().filter(id=roll_id, is_deleted=False).first()
    if not roll:
        raise NotFoundError("Fabric roll not found.")

    _assert_roll_purchasable(roll, buyer)
    validate_roll_breakdown(roll, requested_yards)

    cart, _ = Cart.objects.get_or_create(buyer=buyer)

    cart_item, created = CartItem.objects.get_or_create(
        cart=cart,
        fabric_roll=roll,
        defaults={"requested_yards": requested_yards, "unit_price": roll.price_per_yard},
    )
    if not created:
        cart_item.requested_yards = requested_yards
        cart_item.unit_price = roll.price_per_yard
        cart_item.save(update_fields=["requested_yards", "unit_price", "updated_at"])

    return cart_item


def _generate_order_number() -> str:
    number = generate_reference_code(prefix="ORD", length=8)
    while Order.objects.filter(order_number=number).exists():
        number = generate_reference_code(prefix="ORD", length=8)
    return number


CREDIT_SETTLED_STATUSES = (
    OrderStatusChoices.COMPLETED,
    OrderStatusChoices.CANCELLED,
    OrderStatusChoices.REFUNDED,
)


def outstanding_credit(buyer: Company) -> Decimal:
    """Total of the buyer's B2B-credit orders that haven't been settled yet."""
    return sum(
        (
            o.total_amount
            for o in Order.objects.filter(buyer=buyer, payment_method="B2B_CREDIT").exclude(
                status__in=CREDIT_SETTLED_STATUSES
            )
        ),
        Decimal("0.00"),
    )


def credit_summary(buyer: Company) -> dict:
    limit = buyer.credit_limit or Decimal("0.00")
    outstanding = outstanding_credit(buyer)
    usable = buyer.credit_status in (CreditStatusChoices.ELIGIBLE, CreditStatusChoices.ACTIVE)
    return {
        "credit_limit": limit,
        "outstanding": outstanding,
        "available": max(limit - outstanding, Decimal("0.00")) if usable else Decimal("0.00"),
        "credit_terms_days": buyer.credit_terms_days,
        "credit_status": buyer.credit_status,
        "can_use_credit": usable and limit > outstanding,
    }


def _assert_credit_available(buyer: Company, amount: Decimal) -> None:
    if buyer.credit_status not in (CreditStatusChoices.ELIGIBLE, CreditStatusChoices.ACTIVE):
        raise ValidationError(
            "Your company is not approved for B2B credit. Choose another payment method.",
            code="credit_not_available",
        )
    outstanding = outstanding_credit(buyer)
    if outstanding + amount > buyer.credit_limit:
        raise ValidationError(
            f"This order exceeds your available B2B credit (limit ৳{buyer.credit_limit}, "
            f"outstanding ৳{outstanding}).",
            code="credit_limit_exceeded",
        )


@transaction.atomic
def checkout_cart(
    *,
    buyer: Company,
    payment_method: str = "BKASH",
    delivery_notes: str = "",
    item_ids: Iterable[str] | None = None,
    actor=None,
) -> Order:
    """
    Converts Cart (or a subset of its items) into an Order:
    1. Locks all affected rolls with select_for_update() in a stable order (avoids deadlocks).
    2. Re-validates availability and breakdown rules at current prices.
    3. Deducts available yards atomically and writes append-only StockLedger rows.
    4. Creates Order, OrderItems, and initial OrderTrackingEvent.
    5. Removes the checked-out items from the cart.
    """
    cart = Cart.objects.filter(buyer=buyer).first()
    if not cart:
        raise RollBreakdownError("Cart is empty. Add a fabric roll breakdown first.")

    cart_items = cart.items.all()
    if item_ids is not None:
        item_ids = [str(i) for i in item_ids]
        cart_items = cart_items.filter(id__in=item_ids)
        if cart_items.count() != len(set(item_ids)):
            raise NotFoundError("One or more selected cart items were not found.")

    cart_items = list(cart_items.order_by("fabric_roll_id"))
    if not cart_items:
        raise RollBreakdownError("Cart is empty. Add a fabric roll breakdown first.")

    roll_ids = [item.fabric_roll_id for item in cart_items]
    rolls = {
        roll.id: roll
        for roll in FabricRoll.objects.select_for_update()
        .filter(id__in=roll_ids, is_deleted=False)
        .order_by("id")
    }

    subtotal = Decimal("0.00")
    total_yards = Decimal("0.00")
    lines = []
    for item in cart_items:
        roll = rolls.get(item.fabric_roll_id)
        if roll is None:
            raise NotFoundError("A fabric roll in your cart is no longer available.")
        _assert_roll_purchasable(roll, buyer)
        validate_roll_breakdown(roll, item.requested_yards)

        line_total = (item.requested_yards * roll.price_per_yard).quantize(Decimal("0.01"))
        subtotal += line_total
        total_yards += item.requested_yards
        lines.append((roll, item.requested_yards, roll.price_per_yard, line_total))

    fees = calculate_order_fees(subtotal, total_yards)

    if payment_method == "B2B_CREDIT":
        _assert_credit_available(buyer, fees["total_amount"])

    order = Order.objects.create(
        order_number=_generate_order_number(),
        buyer=buyer,
        status=OrderStatusChoices.PAID_CREDIT_APPROVED,
        payment_method=payment_method,
        delivery_notes=delivery_notes,
        **fees,
    )

    for roll, yards, unit_price, line_total in lines:
        roll.available_yards -= yards
        roll.status = (
            RollStatusChoices.SOLD_OUT
            if roll.available_yards == Decimal("0.00")
            else RollStatusChoices.RESERVED_PARTIAL
        )
        roll.save(update_fields=["available_yards", "status", "updated_at"])

        StockLedger.objects.create(
            fabric_roll=roll,
            transaction_type=StockTransactionTypeChoices.ORDER_CUT,
            yards_change=-yards,
            balance_after=roll.available_yards,
            reference_id=order.order_number,
            actor=actor,
            notes=f"Order checkout hold by {buyer.name}",
        )

        OrderItem.objects.create(
            order=order,
            fabric_roll=roll,
            requested_yards=yards,
            unit_price=unit_price,
            subtotal=line_total,
            min_cut_length_snapshot=roll.min_cut_length_yards,
            remaining_yards_snapshot=roll.available_yards,
            factory_payout_amount=line_total,
            status="PENDING",
        )

    OrderTrackingEvent.objects.create(
        order=order,
        from_status=OrderStatusChoices.DRAFT,
        to_status=order.status,
        title="Order Placed & Payment Authorized",
        description=f"Breakdown hold confirmed for {total_yards} yards. Cutting job dispatched to Tejgaon Hub.",
        location="FabriLink Central Clearing",
        actor=actor,
    )

    CartItem.objects.filter(id__in=[item.id for item in cart_items]).delete()

    return order


def is_valid_transition(from_status: str, to_status: str) -> bool:
    if from_status == to_status:
        return False
    if to_status == OrderStatusChoices.CANCELLED:
        return from_status in CANCELLABLE_STATUSES
    if to_status in EXCEPTION_TRANSITIONS.get(from_status, set()):
        return True
    if from_status in FULFILMENT_PIPELINE and to_status in FULFILMENT_PIPELINE:
        return FULFILMENT_PIPELINE.index(to_status) > FULFILMENT_PIPELINE.index(from_status)
    return False


def _restock_cancelled_order(order: Order, actor=None) -> None:
    items = list(order.items.all())
    rolls = {
        roll.id: roll
        for roll in FabricRoll.all_objects.select_for_update()
        .filter(id__in=[i.fabric_roll_id for i in items])
        .order_by("id")
    }
    for item in items:
        roll = rolls[item.fabric_roll_id]
        roll.available_yards += item.requested_yards
        if roll.status in (RollStatusChoices.SOLD_OUT, RollStatusChoices.RESERVED_PARTIAL):
            roll.status = (
                RollStatusChoices.ACTIVE
                if roll.available_yards >= roll.total_yards
                else RollStatusChoices.RESERVED_PARTIAL
            )
        roll.save(update_fields=["available_yards", "status", "updated_at"])
        StockLedger.objects.create(
            fabric_roll=roll,
            transaction_type=StockTransactionTypeChoices.RETURN_RESTOCK,
            yards_change=item.requested_yards,
            balance_after=roll.available_yards,
            reference_id=order.order_number,
            actor=actor,
            notes=f"Restocked after cancellation of {order.order_number}",
        )
        item.status = "CANCELLED"
        item.save(update_fields=["status", "updated_at"])


@transaction.atomic
def transition_order_status(
    *,
    order_id: str,
    new_status: str,
    actor=None,
    notes: str = "",
    location: str = "",
) -> Order:
    """Moves an order through its lifecycle, recording an auditable tracking event."""
    order = Order.objects.select_for_update().filter(id=order_id).first()
    if not order:
        raise NotFoundError("Order not found.")

    if new_status not in OrderStatusChoices.values:
        raise ValidationError(f"Unknown order status: {new_status}")

    from_status = order.status
    if not is_valid_transition(from_status, new_status):
        raise InvalidStateTransitionError(
            f"Cannot move order {order.order_number} from {from_status} to {new_status}."
        )

    if new_status == OrderStatusChoices.CANCELLED:
        _restock_cancelled_order(order, actor=actor)
        order.cancellation_reason = notes

    order.status = new_status
    order.save(update_fields=["status", "cancellation_reason", "updated_at"])

    OrderTrackingEvent.objects.create(
        order=order,
        from_status=from_status,
        to_status=new_status,
        title=STATUS_EVENT_TITLES.get(new_status, f"Order status updated to {new_status}"),
        description=notes or f"Order transitioned from {from_status} to {new_status}.",
        location=location or "Tejgaon Central Hub",
        actor=actor,
    )
    return order
