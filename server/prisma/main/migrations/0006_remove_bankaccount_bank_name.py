"""Remove bank_name from BankAccount."""
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0005_bankaccount_bank_name'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='bankaccount',
            name='bank_name',
        ),
    ]
