from django.contrib import admin

from .models import PaymentSettings, PaymentSubmission


@admin.register(PaymentSettings)
class PaymentSettingsAdmin(admin.ModelAdmin):
    fieldsets = (
        ("bKash", {"fields": ("bkash_number", "bkash_account_type")}),
        ("Nagad", {"fields": ("nagad_number", "nagad_account_type")}),
        (
            "Bank account (local BEFTN/RTGS and international SWIFT)",
            {
                "fields": (
                    "bank_account_name",
                    "bank_account_number",
                    "bank_name",
                    "bank_branch",
                    "bank_routing_number",
                    "bank_swift_code",
                    "bank_iban",
                    "bank_address",
                    "bank_currencies",
                    "intermediary_bank",
                )
            },
        ),
        ("Shown to buyers", {"fields": ("instructions",)}),
    )

    def has_add_permission(self, request):
        return not PaymentSettings.objects.exists()

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(PaymentSubmission)
class PaymentSubmissionAdmin(admin.ModelAdmin):
    list_display = ("order", "buyer", "method", "amount", "currency", "transaction_id", "status", "created_at")
    list_filter = ("status", "method", "currency")
    search_fields = ("transaction_id", "order__order_number", "buyer__name", "sender_account")
    readonly_fields = ("reviewed_by", "reviewed_at", "created_at")
    raw_id_fields = ("order", "buyer")
