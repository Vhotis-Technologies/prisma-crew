"""
One-off migration helper: encrypt plaintext crew bank IBANs already in the database.

Run after deploying field-level encryption so legacy ``BankAccount.iban`` values
gain the ``enc$`` Fernet prefix. Safe to re-run; skips rows already encrypted.
"""
from django.core.management.base import BaseCommand

from main.models import BankAccount
from main.utils.pii_encryption import ENC_PREFIX, encrypt_iban


class Command(BaseCommand):
    """Management command to backfill encrypted IBANs on existing ``BankAccount`` rows."""

    help = "Encrypt plaintext IBAN values on BankAccount rows."

    def handle(self, *args, **options):
        """
        Iterate all bank accounts and encrypt any IBAN not yet prefixed with ``enc$``.

        Args:
            *args: Unused positional args from Django.
            **options: Unused command options.

        Returns:
            None
        """
        updated = 0
        for account in BankAccount.objects.all().iterator():
            raw = (account.iban or "").strip()
            if not raw or raw.startswith(ENC_PREFIX):
                continue
            # At-rest encryption backfill: plaintext legacy row → enc$ token in DB
            account.iban = encrypt_iban(raw)
            account.save(update_fields=["iban", "updated_at"])
            updated += 1
        self.stdout.write(self.style.SUCCESS(f"Encrypted {updated} bank account IBAN(s)."))
