import uuid

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('main', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='JobReassignmentAudit',
            fields=[
                (
                    'id',
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ('booking_reference', models.CharField(db_index=True, max_length=120)),
                ('is_bulk', models.BooleanField(default=False)),
                ('is_express', models.BooleanField(default=False)),
                ('job_count', models.PositiveIntegerField(default=1)),
                ('old_detailer_ids', models.JSONField(blank=True, default=list)),
                ('new_detailer_ids', models.JSONField(blank=True, default=list)),
                (
                    'reason_code',
                    models.CharField(
                        choices=[
                            ('illness', 'Crew illness'),
                            ('emergency', 'Personal emergency'),
                            ('vehicle_issue', 'Vehicle / equipment issue'),
                            ('no_show', 'Crew no-show'),
                            ('schedule_conflict', 'Schedule conflict'),
                            ('other', 'Other'),
                        ],
                        default='other',
                        max_length=32,
                    ),
                ),
                ('reason_notes', models.TextField(blank=True, default='')),
                ('support_user_id', models.CharField(blank=True, default='', max_length=120)),
                ('support_user_email', models.CharField(blank=True, default='', max_length=255)),
                ('previous_status', models.CharField(blank=True, default='', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(
                        fields=['booking_reference', '-created_at'],
                        name='main_jobrea_booking_b1d7a0_idx',
                    ),
                ],
            },
        ),
    ]
