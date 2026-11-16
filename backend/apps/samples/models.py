from django.db import models

from apps.catalog.models import FabricRoll
from apps.companies.models import Company
from common.models import TimeStampedModel, UUIDModel


class SwatchSize(models.TextChoices):
    A4 = "A4", "A4 swatch"
    HALF_YARD = "HALF_YARD", "Half yard"
    ONE_YARD = "ONE_YARD", "One yard"


class SampleStatus(models.TextChoices):
    REQUESTED = "REQUESTED", "Requested"
    ACCEPTED = "ACCEPTED", "Accepted"
    SHIPPED = "SHIPPED", "Shipped"
    DELIVERED = "DELIVERED", "Delivered"
    DECLINED = "DECLINED", "Declined"
    CANCELLED = "CANCELLED", "Cancelled"


OPEN_SAMPLE_STATUSES = (SampleStatus.REQUESTED, SampleStatus.ACCEPTED, SampleStatus.SHIPPED)


class SampleRequest(UUIDModel, TimeStampedModel):
    """A buyer asking the mill for a physical swatch of a roll before ordering yardage."""

    buyer = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="sample_requests")
    factory = models.ForeignKey(
        Company, on_delete=models.CASCADE, related_name="incoming_sample_requests"
    )
    fabric_roll = models.ForeignKey(
        FabricRoll, on_delete=models.CASCADE, related_name="sample_requests"
    )
    swatch_size = models.CharField(
        max_length=20, choices=SwatchSize.choices, default=SwatchSize.A4
    )
    notes = models.TextField(blank=True)
    delivery_address = models.TextField(blank=True)
    # Price the mill listed for a sample when the request was made (for reference).
    sample_price = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    status = models.CharField(
        max_length=20,
        choices=SampleStatus.choices,
        default=SampleStatus.REQUESTED,
        db_index=True,
    )
    factory_note = models.TextField(blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Sample Request"
        verbose_name_plural = "Sample Requests"

    def __str__(self):
        return f"Sample of {self.fabric_roll.roll_code} for {self.buyer.name} ({self.status})"
