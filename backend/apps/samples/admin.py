from django.contrib import admin

from .models import SampleRequest


@admin.register(SampleRequest)
class SampleRequestAdmin(admin.ModelAdmin):
    list_display = ("fabric_roll", "buyer", "factory", "swatch_size", "status", "created_at")
    list_filter = ("status", "swatch_size")
    search_fields = ("fabric_roll__roll_code", "buyer__name", "factory__name")
    raw_id_fields = ("fabric_roll", "buyer", "factory")
