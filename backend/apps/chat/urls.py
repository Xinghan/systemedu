from django.urls import path

from . import views

app_name = "chat"

urlpatterns = [
    path("message/", views.SendMessageView.as_view(), name="send-message"),
    path("history/<int:pk>/", views.SessionHistoryView.as_view(), name="session-history"),
]
