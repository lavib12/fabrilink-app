from django.conf import settings
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .selectors import get_user_by_id
from .serializers import (
    LoginSerializer,
    LogoutRequestSerializer,
    TokenRefreshRequestSerializer,
    UserDetailSerializer,
    UserProfileSerializer,
    UserRegistrationSerializer,
)
from .services import authenticate_user, register_user, update_user_profile


def set_refresh_cookie(response: Response, refresh_token: str) -> None:
    """Helper to attach the refresh token as an httpOnly secure cookie."""
    max_age = int(settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds())
    response.set_cookie(
        key="fabrilink_refresh_token",
        value=refresh_token,
        max_age=max_age,
        httponly=True,
        secure=not settings.DEBUG,
        samesite="Lax",
        path="/api/v1/auth/",
    )


MOBILE_CLIENT_HEADER = "HTTP_X_CLIENT_PLATFORM"


def is_mobile_client(request) -> bool:
    """Native apps can't rely on httpOnly cookies, so they receive the refresh token in the body."""
    return request.META.get(MOBILE_CLIENT_HEADER, "").lower() == "mobile"


def attach_refresh_token(request, response: Response, refresh_token: str) -> None:
    """Deliver the refresh token as a cookie (web) and, for mobile clients, in the body too."""
    set_refresh_cookie(response, refresh_token)
    if is_mobile_client(request):
        response.data["data"]["refresh_token"] = refresh_token


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        request=UserRegistrationSerializer,
        responses={201: UserDetailSerializer},
        description="Register a new factory or buyer account.",
    )
    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user, tokens = register_user(**serializer.validated_data)

        user_data = UserDetailSerializer(user).data
        response = Response(
            {
                "success": True,
                "message": "User registered successfully.",
                "data": {
                    "user": user_data,
                    "access_token": tokens["access"],
                },
            },
            status=status.HTTP_201_CREATED,
        )
        attach_refresh_token(request, response, tokens["refresh"])
        return response


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        request=LoginSerializer,
        responses={200: UserDetailSerializer},
        description="Authenticate user with email and password.",
    )
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user, tokens = authenticate_user(
            email=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
        )

        user_data = UserDetailSerializer(user).data
        response = Response(
            {
                "success": True,
                "message": "Logged in successfully.",
                "data": {
                    "user": user_data,
                    "access_token": tokens["access"],
                },
            },
            status=status.HTTP_200_OK,
        )
        attach_refresh_token(request, response, tokens["refresh"])
        return response


class TokenRefreshCookieView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        request=TokenRefreshRequestSerializer,
        responses={200: OpenApiResponse(description="Refreshed access token")},
        description="Rotate refresh token from cookie and issue new access token.",
    )
    def post(self, request):
        if is_mobile_client(request):
            refresh_token = request.data.get("refresh")
        else:
            refresh_token = request.COOKIES.get("fabrilink_refresh_token") or request.data.get(
                "refresh"
            )
        if not refresh_token:
            return Response(
                {
                    "success": False,
                    "error": {"code": "missing_token", "message": "No refresh token provided."},
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            token = RefreshToken(refresh_token)

            # Deleted or deactivated accounts must not be able to mint new tokens.
            user = get_user_by_id(token["user_id"])
            if user is None or not user.is_active:
                token.blacklist()
                raise TokenError("User account is inactive or no longer exists.")

            new_access_token = str(token.access_token)

            # Rotate refresh token if enabled
            if settings.SIMPLE_JWT.get("ROTATE_REFRESH_TOKENS", False):
                token.blacklist()
                new_refresh = RefreshToken.for_user(user)
                response = Response(
                    {"success": True, "data": {"access_token": new_access_token}},
                    status=status.HTTP_200_OK,
                )
                attach_refresh_token(request, response, str(new_refresh))
                return response

            return Response(
                {"success": True, "data": {"access_token": new_access_token}},
                status=status.HTTP_200_OK,
            )
        except TokenError as e:
            return Response(
                {"success": False, "error": {"code": "invalid_token", "message": str(e)}},
                status=status.HTTP_401_UNAUTHORIZED,
            )


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        request=LogoutRequestSerializer,
        responses={200: OpenApiResponse(description="Logged out successfully")},
        description="Blacklist refresh token and clear authentication cookie.",
    )
    def post(self, request):
        refresh_token = request.COOKIES.get("fabrilink_refresh_token") or request.data.get(
            "refresh"
        )
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except TokenError:
                pass

        response = Response(
            {"success": True, "message": "Successfully logged out."},
            status=status.HTTP_200_OK,
        )
        response.delete_cookie("fabrilink_refresh_token", path="/api/v1/auth/")
        return response


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        responses={200: UserDetailSerializer},
        description="Get current authenticated user profile, roles, and company.",
    )
    def get(self, request):
        user = get_user_by_id(str(request.user.id))
        serializer = UserDetailSerializer(user)
        return Response({"success": True, "data": serializer.data})

    @extend_schema(
        request=UserProfileSerializer,
        responses={200: UserDetailSerializer},
        description="Update profile attributes for current user.",
    )
    def patch(self, request):
        serializer = UserProfileSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        update_user_profile(user=request.user, data=serializer.validated_data)
        user = get_user_by_id(str(request.user.id))
        return Response({"success": True, "data": UserDetailSerializer(user).data})
