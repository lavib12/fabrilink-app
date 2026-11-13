from django.urls import path

from .views import (
    AdminKYCQueueView,
    AdminVerifyCompanyView,
    BuyerListView,
    CompanyAddressListView,
    FactoryStorefrontDetailView,
    FactoryStoreListView,
    MyCompanyView,
)

app_name = "companies"

urlpatterns = [
    path("my-company/", MyCompanyView.as_view(), name="my_company"),
    path("addresses/", CompanyAddressListView.as_view(), name="company_addresses"),
    path("buyers/", BuyerListView.as_view(), name="buyer_list"),
    path("factories/", FactoryStoreListView.as_view(), name="factory_store_list"),
    path(
        "factories/<uuid:factory_id>/",
        FactoryStorefrontDetailView.as_view(),
        name="factory_storefront_detail",
    ),
    path("admin/kyc-queue/", AdminKYCQueueView.as_view(), name="admin_kyc_queue"),
    path(
        "admin/<uuid:company_id>/verify/",
        AdminVerifyCompanyView.as_view(),
        name="admin_verify_company",
    ),
]
