import uuid

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("main", "0006_remove_bankaccount_bank_name"),
    ]

    operations = [
        migrations.CreateModel(
            name="PrivacyPolicy",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("version", models.CharField(max_length=20, unique=True)),
                ("content", models.TextField()),
                ("last_updated", models.DateTimeField(auto_now=True)),
            ],
        ),
    ]
