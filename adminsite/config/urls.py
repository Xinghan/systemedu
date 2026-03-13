from django.urls import include, path

urlpatterns = [
    path("api/admin/", include("admin_api.urls")),
]
