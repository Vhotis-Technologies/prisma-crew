from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("main", "0007_privacypolicy"),
    ]

    operations = [
        migrations.AlterField(
            model_name="bankaccount",
            name="iban",
            field=models.CharField(max_length=512),
        ),
    ]
