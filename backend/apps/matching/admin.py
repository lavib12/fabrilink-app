from django.contrib import admin

from .models import SourcingRequest


@admin.register(SourcingRequest)
class SourcingRequestAdmin(admin.ModelAdmin):
    list_display = ("fabric_name", "buyer", "target_gsm", "required_yards", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("fabric_name", "buyer__name", "color_preference")
