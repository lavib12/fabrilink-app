from django.db import migrations


def activate_credit_lines(apps, schema_editor):
    """
    Companies approved with a credit limit were left INELIGIBLE because approval never
    activated the credit line, so B2B-credit checkout always failed. Fix existing rows.
    """
    Company = apps.get_model("companies", "Company")
    Company.objects.filter(
        verification_status="APPROVED",
        credit_limit__gt=0,
        credit_status="INELIGIBLE",
    ).update(credit_status="ACTIVE")


class Migration(migrations.Migration):
    dependencies = [
        ("companies", "0002_initial"),
    ]

    operations = [
        migrations.RunPython(activate_credit_lines, migrations.RunPython.noop),
    ]
