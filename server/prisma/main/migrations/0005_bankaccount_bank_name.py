"""Add bank_name to BankAccount (holder name, bank, IBAN only)."""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0004_bankaccount_trim_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='bankaccount',
            name='bank_name',
            field=models.CharField(default='', max_length=100, blank=True),
            preserve_default=True,
        ),
        migrations.AlterField(
            model_name='bankaccount',
            name='bank_name',
            field=models.CharField(max_length=100),
        ),
    ]
