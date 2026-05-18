"""Trim BankAccount to the fields actually used for payouts.

Only ``account_name`` and ``iban`` are required to wire a bank transfer for a
crew member. The rest (``account_number``, ``bank_name``, ``bic``, ``sort_code``)
were never used downstream and are removed.
"""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0003_payouthistory_bank_account_optional'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='bankaccount',
            name='account_number',
        ),
        migrations.RemoveField(
            model_name='bankaccount',
            name='bank_name',
        ),
        migrations.RemoveField(
            model_name='bankaccount',
            name='bic',
        ),
        migrations.RemoveField(
            model_name='bankaccount',
            name='sort_code',
        ),
    ]
