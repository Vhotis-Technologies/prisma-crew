"""Drop unused TimeSlot and TrainingRecord tables.

Availability (unavailability lockouts) and payroll models are unchanged.
"""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("main", "0009_servicetype_name_ci_unique"),
    ]

    operations = [
        migrations.DeleteModel(name="TimeSlot"),
        migrations.DeleteModel(name="TrainingRecord"),
    ]
