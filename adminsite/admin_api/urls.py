from django.urls import path

from . import views

app_name = "admin_api"

urlpatterns = [
    # Auth
    path("auth/login/", views.AdminLoginView.as_view(), name="login"),
    path("auth/refresh/", views.AdminRefreshView.as_view(), name="refresh"),
    # Projects CRUD
    path("projects/", views.ProjectListCreateView.as_view(), name="project-list"),
    path("projects/<int:pk>/", views.ProjectDetailUpdateDeleteView.as_view(), name="project-detail"),
    # Knowledge tree: import / export / preview
    path("projects/<int:pk>/import-tree/", views.ImportKnowledgeTreeView.as_view(), name="import-tree"),
    path("projects/<int:pk>/export-tree/", views.ExportKnowledgeTreeView.as_view(), name="export-tree"),
    path("projects/<int:pk>/tree-preview/", views.TreePreviewView.as_view(), name="tree-preview"),
    # AI generate knowledge tree
    path("projects/<int:pk>/generate-tree/", views.GenerateKnowledgeTreeView.as_view(), name="generate-tree"),
    # Clone project (template system)
    path("projects/<int:pk>/clone/", views.CloneProjectView.as_view(), name="clone-project"),
]
