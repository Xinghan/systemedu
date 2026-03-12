from django.urls import path

from . import views

app_name = "progress"

urlpatterns = [
    path("enroll/<int:project_id>/", views.EnrollProjectView.as_view(), name="enroll"),
    path("enrollments/", views.MyEnrollmentsView.as_view(), name="enrollments"),
    path("projects/<int:project_id>/", views.ProjectProgressView.as_view(), name="project-progress"),
    path("achievements/", views.MyAchievementsView.as_view(), name="achievements"),
]
