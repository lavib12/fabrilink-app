from django.conf import settings
from django.db import migrations


def approve_pending_buyers(apps, schema_editor):
    """
    Buyer verification became optional. Buyers who signed up while it was mandatory
    and are still waiting are approved so they can order. Rejected or suspended buyers
    and all factories are left as they are.
    """
    if settings.BUYER_KYC_REQUIRED:
        return
    Company = apps.get_model("companies", "Company")
    Company.objects.filter(company_type="BUYER", verification_status="PENDING").update(
        verification_status="APPROVED"
    )


class Migration(migrations.Migration):
    dependencies = [
        ("companies", "0003_activate_existing_credit_lines"),
    ]

    operations = [
        migrations.RunPython(approve_pending_buyers, migrations.RunPython.noop),
    ]
