from django.urls import path

from . import views

app_name = "projects"

urlpatterns = [
    path("", views.ProjectListView.as_view(), name="list"),
    path("<int:pk>/", views.ProjectDetailView.as_view(), name="detail"),
    path("knodes/<int:pk>/", views.KnowledgeNodeDetailView.as_view(), name="knode-detail"),
    path("<int:pk>/generate-tree/", views.GenerateKnowledgeTreeView.as_view(), name="generate-tree"),
]
