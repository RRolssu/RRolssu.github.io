# Generated by Django 5.1.6 on 2025-03-10 14:06

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("gantt", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="task",
            name="sort_order",
            field=models.IntegerField(default=0),
        ),
    ]
