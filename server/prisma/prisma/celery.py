import os
from celery import Celery
from celery.signals import task_prerun, task_postrun

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'prisma.settings')

app = Celery('prisma')

# Using a string here means the worker doesn't have to serialize
# the configuration object to child processes.
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load task modules from all registered Django apps.
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    pass


@task_prerun.connect
def close_db_connection_before_task(sender=None, **kwargs):
    """Close old database connections before each task to prevent stale connection errors"""
    from django.db import close_old_connections
    close_old_connections()


@task_postrun.connect
def close_db_connection_after_task(sender=None, **kwargs):
    """Close old database connections after each task to prevent connection leaks"""
    from django.db import close_old_connections
    close_old_connections()
