from django.urls import path

from . import views

app_name = "projects"

urlpatterns = [
    path("", views.ProjectListView.as_view(), name="list"),
    path("my/", views.MyProjectsView.as_view(), name="my-projects"),
    path("<int:pk>/", views.ProjectDetailView.as_view(), name="detail"),
    path("<int:pk>/fork/", views.ForkProjectView.as_view(), name="fork"),
    path("<int:pk>/check-fork/", views.CheckForkView.as_view(), name="check-fork"),
    path("<int:pk>/progress-summary/", views.ProgressSummaryView.as_view(), name="progress-summary"),
    path("knodes/<int:pk>/", views.KnowledgeNodeDetailView.as_view(), name="knode-detail"),
    path("<int:pk>/generate-tree/", views.GenerateKnowledgeTreeView.as_view(), name="generate-tree"),
]
