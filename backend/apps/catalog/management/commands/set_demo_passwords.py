import os

from django.core.management.base import BaseCommand

from apps.users.models import User

ADMIN_EMAIL = "admin@fabrilink.com.bd"
DEMO_EMAILS = [
    "hub@fabrilink.com.bd",
    "sales@squarefashions.com",
    "surplus@hameemgroup.com",
    "fabrics@beximcofilaments.com",
    "buyer@dhakatrendz.com",
    "newbuyer@testboutique.com",
]


class Command(BaseCommand):
    help = (
        "Replaces the published seed passwords on a deployed server. Reads "
        "DEMO_ADMIN_PASSWORD (admin account) and DEMO_USER_PASSWORD (all other "
        "demo accounts); an unset variable leaves those accounts untouched."
    )

    def handle(self, *args, **options):
        admin_password = os.getenv("DEMO_ADMIN_PASSWORD", "").strip()
        user_password = os.getenv("DEMO_USER_PASSWORD", "").strip()

        changed = 0
        if admin_password:
            changed += self._set([ADMIN_EMAIL], admin_password)
        if user_password:
            changed += self._set(DEMO_EMAILS, user_password)
        self.stdout.write(f"Demo passwords updated for {changed} account(s).")

    def _set(self, emails, password):
        count = 0
        for user in User.objects.filter(email__in=emails):
            if not user.check_password(password):
                user.set_password(password)
                user.save(update_fields=["password"])
            count += 1
        return count
