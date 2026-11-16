from django.db import models

from apps.companies.models import Company, CompanyAddress
from common.models import SoftDeleteModel, TimeStampedModel, UUIDModel


class FabricCategory(UUIDModel, TimeStampedModel):
    """Broad fabric category (e.g. Knit, Woven, Denim, Speciality)."""

    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to="categories/", blank=True, null=True)

    class Meta:
        verbose_name = "Fabric Category"
        verbose_name_plural = "Fabric Categories"
        ordering = ["name"]

    def __str__(self):
        return self.name


class FabricType(UUIDModel, TimeStampedModel):
    """Specific fabric construction (Single Jersey, Rib Knit, Denim Twill, Poplin, Voile, Linen)."""

    category = models.ForeignKey(
        FabricCategory, on_delete=models.PROTECT, related_name="fabric_types"
    )
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    default_gsm_range = models.CharField(max_length=50, blank=True)

    class Meta:
        verbose_name = "Fabric Type"
        verbose_name_plural = "Fabric Types"
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.category.name})"


class QualityGradeChoices(models.TextChoices):
    GRADE_A = "GRADE_A", "Grade A (Export Surplus)"
    GRADE_B = "GRADE_B", "Grade B (Minor Blemishes)"
    SURPLUS_FRESH = "SURPLUS_FRESH", "Fresh Surplus (Overrun)"
    REMNANT = "REMNANT", "End-of-Run Remnant"


class RollStatusChoices(models.TextChoices):
    DRAFT = "DRAFT", "Draft"
    ACTIVE = "ACTIVE", "Active / Listed"
    RESERVED_PARTIAL = "RESERVED_PARTIAL", "Reserved (Partial)"
    SOLD_OUT = "SOLD_OUT", "Sold Out"
    ARCHIVED = "ARCHIVED", "Archived"


class FabricRoll(UUIDModel, TimeStampedModel, SoftDeleteModel):
    """Individual surplus fabric roll listed by an export garment factory."""

    roll_code = models.CharField(max_length=50, unique=True, db_index=True)
    factory = models.ForeignKey(Company, on_delete=models.PROTECT, related_name="fabric_rolls")
    fabric_type = models.ForeignKey(FabricType, on_delete=models.PROTECT, related_name="rolls")

    title = models.CharField(max_length=255)
    composition = models.CharField(max_length=255)  # e.g. 100% Cotton, 95% Cotton 5% Elastane
    gsm = models.IntegerField(db_index=True)  # Grams per Square Meter
    width_inches = models.DecimalField(max_digits=5, decimal_places=2, db_index=True)

    color_name = models.CharField(max_length=100, db_index=True)
    color_hex = models.CharField(max_length=7, default="#000000")  # e.g. #1E3A8A
    pattern = models.CharField(
        max_length=100, blank=True, default="Solid"
    )  # Solid, Yarn Dye, Print
    finish = models.CharField(max_length=100, blank=True, default="Soft Finish")

    total_yards = models.DecimalField(max_digits=10, decimal_places=2)
    available_yards = models.DecimalField(max_digits=10, decimal_places=2, db_index=True)
    min_cut_length_yards = models.DecimalField(max_digits=8, decimal_places=2, default=5.00)
    price_per_yard = models.DecimalField(max_digits=10, decimal_places=2, db_index=True)  # in BDT

    lot_batch_number = models.CharField(max_length=100, blank=True)
    quality_grade = models.CharField(
        max_length=20,
        choices=QualityGradeChoices.choices,
        default=QualityGradeChoices.GRADE_A,
    )
    defect_notes = models.TextField(blank=True)

    location_address = models.ForeignKey(
        CompanyAddress,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stored_rolls",
    )
    status = models.CharField(
        max_length=20,
        choices=RollStatusChoices.choices,
        default=RollStatusChoices.ACTIVE,
        db_index=True,
    )

    is_sample_available = models.BooleanField(default=True)
    sample_price = models.DecimalField(max_digits=8, decimal_places=2, default=150.00)

    # Custom Fabric Profile built by factory for a specific buyer
    target_buyer = models.ForeignKey(
        Company,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="custom_fabric_profiles",
        help_text="If set, this fabric profile is built specifically for this buyer.",
    )
    is_custom_profile = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Indicates if this roll was built as a custom fabric profile for a buyer.",
    )
    buyer_spec_notes = models.TextField(
        blank=True,
        help_text="Custom specifications, yarn details, or merchandiser notes for the target buyer.",
    )

    class Meta:
        verbose_name = "Fabric Roll"
        verbose_name_plural = "Fabric Rolls"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["fabric_type", "status", "gsm"]),
            models.Index(fields=["price_per_yard", "available_yards"]),
        ]

    def __str__(self):
        return f"{self.roll_code} - {self.title} ({self.available_yards} yds)"


class FabricRollImage(UUIDModel, TimeStampedModel):
    """Product images for a fabric roll."""

    fabric_roll = models.ForeignKey(FabricRoll, on_delete=models.CASCADE, related_name="images")
    image_url = models.URLField(max_length=500, blank=True)
    image_file = models.ImageField(upload_to="fabric_rolls/", blank=True, null=True)
    is_primary = models.BooleanField(default=False)
    sort_order = models.IntegerField(default=0)

    class Meta:
        ordering = ["sort_order", "created_at"]

    def __str__(self):
        return f"Image for {self.fabric_roll.roll_code}"


class UploadedImage(UUIDModel, TimeStampedModel):
    """
    A listing photo uploaded from the app. The bytes live in the database so they
    survive restarts on hosts with a temporary disk (such as Render's free plan).
    Photos are re-encoded as JPEG and capped in size on upload.
    """

    uploaded_by = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, related_name="uploaded_images"
    )
    company = models.ForeignKey(
        Company, on_delete=models.CASCADE, null=True, related_name="uploaded_images"
    )
    content_type = models.CharField(max_length=50, default="image/jpeg")
    # Private images (payment receipts) are never served by the public image URL.
    is_private = models.BooleanField(default=False)
    data = models.BinaryField()
    width = models.PositiveIntegerField(default=0)
    height = models.PositiveIntegerField(default=0)
    size_bytes = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"Upload {self.id} ({self.width}x{self.height})"
