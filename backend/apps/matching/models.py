from django.db import models

from apps.companies.models import Company
from common.models import TimeStampedModel, UUIDModel


class SourcingRequestStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    FULFILLED = "FULFILLED", "Fulfilled"
    CLOSED = "CLOSED", "Closed"


class SourcingRequest(UUIDModel, TimeStampedModel):
    """A buyer's request for a fabric that isn't in the catalog, visible to verified mills."""

    buyer = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="sourcing_requests")
    fabric_name = models.CharField(max_length=255)
    target_gsm = models.PositiveIntegerField(null=True, blank=True)
    required_yards = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    color_preference = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    status = models.CharField(
        max_length=20,
        choices=SourcingRequestStatus.choices,
        default=SourcingRequestStatus.OPEN,
        db_index=True,
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Sourcing Request"
        verbose_name_plural = "Sourcing Requests"

    def __str__(self):
        return f"{self.fabric_name} for {self.buyer.name} ({self.status})"
