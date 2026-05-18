"""Make PayoutHistory.bank_account optional.

Support can now create a crew payout from unpaid earnings before the crew member
has registered a bank account. The bank reference is recorded when support marks
the payout as paid.
"""
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0002_jobreassignmentaudit'),
    ]

    operations = [
        migrations.AlterField(
            model_name='payouthistory',
            name='bank_account',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to='main.bankaccount',
            ),
        ),
    ]
