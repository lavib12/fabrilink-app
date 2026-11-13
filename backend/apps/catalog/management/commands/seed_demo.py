from decimal import Decimal

from django.core.management.base import BaseCommand

from apps.catalog.models import FabricCategory, FabricRoll, FabricRollImage, FabricType
from apps.companies.models import (
    AddressTypeChoices,
    Company,
    CompanyAddress,
    CompanyTypeChoices,
    CreditStatusChoices,
    VerificationStatusChoices,
)
from apps.users.models import RoleChoices, User


class Command(BaseCommand):
    help = "Seeds demo factories, buyers, categories, and surplus fabric rolls."

    def handle(self, *args, **options):
        self.stdout.write("Seeding FabriLink demo marketplace data...")

        # 1. Create Superuser / Admin
        admin_user, _ = User.objects.get_or_create(
            email="admin@fabrilink.com.bd",
            defaults={
                "phone": "+8801700000001",
                "role": RoleChoices.ADMIN,
                "is_staff": True,
                "is_superuser": True,
                "is_verified": True,
            },
        )
        admin_user.set_password("Admin12345!")
        admin_user.save()

        # Cutting-hub operator for the hub queue and barcode scanning screens.
        hub_user, _ = User.objects.get_or_create(
            email="hub@fabrilink.com.bd",
            defaults={
                "phone": "+8801700000002",
                "role": RoleChoices.HUB_STAFF,
                "is_verified": True,
            },
        )
        hub_user.set_password("Hub12345!")
        hub_user.save()

        # 2. Create Garment Factories (Sellers)
        mills = [
            {
                "email": "sales@squarefashions.com",
                "phone": "+8801711000101",
                "name": "Square Fashions Ltd",
                "district": "Gazipur",
                "address": "Kashimpur, Gazipur RMG Zone",
            },
            {
                "email": "surplus@hameemgroup.com",
                "phone": "+8801711000102",
                "name": "Ha-Meem Denim & Knitting Mills",
                "district": "Savar",
                "address": "Ashulia, Savar EPZ Bypass",
            },
            {
                "email": "fabrics@beximcofilaments.com",
                "phone": "+8801711000103",
                "name": "Beximco Textiles Ltd",
                "district": "Dhaka",
                "address": "Sarabo, Kashimpur Road",
            },
        ]

        factories = []
        for m in mills:
            f_user, _ = User.objects.get_or_create(
                email=m["email"],
                defaults={
                    "phone": m["phone"],
                    "role": RoleChoices.FACTORY,
                    "is_verified": True,
                },
            )
            f_user.set_password("Factory12345!")
            f_user.save()

            company, _ = Company.objects.get_or_create(
                user=f_user,
                defaults={
                    "name": m["name"],
                    "company_type": CompanyTypeChoices.FACTORY,
                    "verification_status": VerificationStatusChoices.APPROVED,
                    "trade_license_number": "TRAD-GZ-2024-8891",
                    "tin_number": "1982736451",
                    "contact_email": m["email"],
                    "contact_phone": m["phone"],
                },
            )
            CompanyAddress.objects.get_or_create(
                company=company,
                address_type=AddressTypeChoices.FACTORY_PREMISES,
                defaults={
                    "division": "Dhaka",
                    "district": m["district"],
                    "upazila_thana": m["district"],
                    "street_address": m["address"],
                    "postal_code": "1700",
                    "is_default": True,
                },
            )
            factories.append(company)

        # 3. Create Demo Buyer (Boutique)
        buyer_user, _ = User.objects.get_or_create(
            email="buyer@dhakatrendz.com",
            defaults={
                "phone": "+8801811000201",
                "role": RoleChoices.BUYER,
                "is_verified": True,
            },
        )
        buyer_user.set_password("Buyer12345!")
        buyer_user.save()

        buyer_company, _ = Company.objects.get_or_create(
            user=buyer_user,
            defaults={
                "name": "Dhaka Trendz Boutique",
                "company_type": CompanyTypeChoices.BUYER,
                "verification_status": VerificationStatusChoices.APPROVED,
                "trade_license_number": "TRAD-DK-2025-4120",
                "contact_email": "buyer@dhakatrendz.com",
                "contact_phone": "+8801811000201",
                "credit_limit": Decimal("50000.00"),
                "credit_terms_days": 30,
                "credit_status": CreditStatusChoices.ACTIVE,
            },
        )
        CompanyAddress.objects.get_or_create(
            company=buyer_company,
            address_type=AddressTypeChoices.DELIVERY,
            defaults={
                "division": "Dhaka",
                "district": "Dhaka",
                "upazila_thana": "Banani",
                "street_address": "House 42, Road 11, Block D, Banani",
                "postal_code": "1213",
                "is_default": True,
            },
        )

        silk_buyer_user, _ = User.objects.get_or_create(
            email="newbuyer@testboutique.com",
            defaults={
                "phone": "+8801811000305",
                "role": RoleChoices.BUYER,
                "is_verified": True,
            },
        )
        silk_buyer_user.set_password("Buyer12345!")
        silk_buyer_user.save()

        silk_buyer_company, _ = Company.objects.get_or_create(
            user=silk_buyer_user,
            defaults={
                "name": "New Silk Test Boutique",
                "company_type": CompanyTypeChoices.BUYER,
                "verification_status": VerificationStatusChoices.APPROVED,
                "trade_license_number": "TRAD-DK-2025-9921",
                "contact_email": "newbuyer@testboutique.com",
                "contact_phone": "+8801811000305",
                "credit_limit": Decimal("75000.00"),
                "credit_terms_days": 30,
                "credit_status": CreditStatusChoices.ACTIVE,
            },
        )
        CompanyAddress.objects.get_or_create(
            company=silk_buyer_company,
            address_type=AddressTypeChoices.DELIVERY,
            defaults={
                "division": "Dhaka",
                "district": "Dhaka",
                "upazila_thana": "Gulshan",
                "street_address": "Avenue 4, Road 103, Gulshan 2",
                "postal_code": "1212",
                "is_default": True,
            },
        )

        # 4. Fabric Categories & Types
        cat_knit, _ = FabricCategory.objects.get_or_create(
            name="Knit Fabrics",
            defaults={
                "slug": "knit-fabrics",
                "description": "Export single jersey, rib knits, french terry, fleece, and pima cottons.",
            },
        )
        cat_woven, _ = FabricCategory.objects.get_or_create(
            name="Woven Fabrics",
            defaults={
                "slug": "woven-fabrics",
                "description": "High-thread-count poplin, linen weaves, twills, and chambray.",
            },
        )
        cat_denim, _ = FabricCategory.objects.get_or_create(
            name="Denim & Twill",
            defaults={
                "slug": "denim-twill",
                "description": "Shuttle loom selvedge denim, stretch denim, ring spun, and heavy twills.",
            },
        )
        cat_silk, _ = FabricCategory.objects.get_or_create(
            name="Luxury & Silk",
            defaults={
                "slug": "luxury-silk",
                "description": "Mulberry silk georgette, satin charmeuse, velvet, and royal damask brocades.",
            },
        )
        cat_eco, _ = FabricCategory.objects.get_or_create(
            name="Sustainable & Eco-Conscious",
            defaults={
                "slug": "eco-conscious-organic",
                "description": "GOTS-certified organic cotton, bamboo lyocell, and recycled blends.",
            },
        )

        type_jersey, _ = FabricType.objects.get_or_create(
            category=cat_knit,
            name="100% Cotton Single Jersey",
            defaults={"slug": "single-jersey", "default_gsm_range": "160-220"},
        )
        type_giza_jersey, _ = FabricType.objects.get_or_create(
            category=cat_knit,
            name="Egyptian Giza Combed Jersey",
            defaults={"slug": "egyptian-giza-jersey", "default_gsm_range": "170-220"},
        )
        type_french_terry, _ = FabricType.objects.get_or_create(
            category=cat_knit,
            name="French Terry Knit",
            defaults={"slug": "french-terry", "default_gsm_range": "240-320"},
        )
        type_linen, _ = FabricType.objects.get_or_create(
            category=cat_woven,
            name="Pure European Flax Linen",
            defaults={"slug": "pure-linen", "default_gsm_range": "140-180"},
        )
        type_denim, _ = FabricType.objects.get_or_create(
            category=cat_denim,
            name="Stretch Indigo Denim 11.5oz",
            defaults={"slug": "stretch-indigo-denim", "default_gsm_range": "360-420"},
        )
        type_selvedge, _ = FabricType.objects.get_or_create(
            category=cat_denim,
            name="Japanese Red-Line Selvedge Denim 13.5oz",
            defaults={"slug": "selvedge-denim-13-5oz", "default_gsm_range": "420-480"},
        )
        type_silk_georgette, _ = FabricType.objects.get_or_create(
            category=cat_silk,
            name="Pure Mulberry Silk Georgette",
            defaults={"slug": "mulberry-silk-georgette", "default_gsm_range": "70-110"},
        )
        type_silk_satin, _ = FabricType.objects.get_or_create(
            category=cat_silk,
            name="Lustrous Silk Satin Charmeuse",
            defaults={"slug": "silk-satin-charmeuse", "default_gsm_range": "80-120"},
        )
        type_jacquard, _ = FabricType.objects.get_or_create(
            category=cat_silk,
            name="Royal Damask Jacquard Brocade",
            defaults={"slug": "damask-jacquard-brocade", "default_gsm_range": "240-320"},
        )
        type_bamboo_terry, _ = FabricType.objects.get_or_create(
            category=cat_eco,
            name="Organic Bamboo Loopback Terry",
            defaults={"slug": "bamboo-loopback-terry", "default_gsm_range": "280-350"},
        )
        type_modal_rib, _ = FabricType.objects.get_or_create(
            category=cat_knit,
            name="Micro-Modal Spandex 2x2 Rib Knit",
            defaults={"slug": "micro-modal-rib-knit", "default_gsm_range": "200-260"},
        )
        type_chambray, _ = FabricType.objects.get_or_create(
            category=cat_woven,
            name="Mercerized Indigo Slub Chambray",
            defaults={"slug": "slub-chambray", "default_gsm_range": "130-180"},
        )
        type_waffle, _ = FabricType.objects.get_or_create(
            category=cat_knit,
            name="Supima Honeycomb Waffle Pique",
            defaults={"slug": "supima-waffle-pique", "default_gsm_range": "300-380"},
        )

        # 5. Surplus Fabric Rolls & Exclusive Fabric Profiles
        rolls_data = [
            # 1. Square Fashions -> Custom Fabric Profile for Dhaka Trendz Boutique (Egyptian Giza Jersey)
            {
                "factory": factories[0],
                "fabric_type": type_giza_jersey,
                "roll_code": "ROL-2026-GIZA01",
                "title": "60s Giza Egyptian Cotton Mercerized Jersey — Royal Emerald",
                "composition": "100% Long-Staple Egyptian Giza Cotton",
                "gsm": 195,
                "width_inches": Decimal("62.00"),
                "color_name": "Royal Emerald Green",
                "color_hex": "#0F5132",
                "pattern": "Solid Single Jersey",
                "finish": "Liquid Ammonia Mercerized & Bio-Polished",
                "total_yards": Decimal("180.00"),
                "available_yards": Decimal("180.00"),
                "min_cut_length_yards": Decimal("10.00"),
                "price_per_yard": Decimal("480.00"),
                "lot_batch_number": "SQ-GIZA-8821",
                "quality_grade": "GRADE_A",
                "defect_notes": "Zero knit slubs. Certified Oeko-Tex Standard 100 Class 1. High luster sheen.",
                "is_custom_profile": True,
                "target_buyer": buyer_company,
                "buyer_spec_notes": "Custom formulation created by Square Fashions Merchandiser for Dhaka Trendz Autumn Gala collection. Exclusively knitted using 60/1 compact Egyptian Giza yarn with silk-like liquid ammonia finish.",
                "images": [
                    "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1000&q=80",
                    "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=1000&q=80",
                ],
            },
            # 2. Ha-Meem -> Custom Fabric Profile for Dhaka Trendz Boutique (Raw Selvedge Denim)
            {
                "factory": factories[1],
                "fabric_type": type_selvedge,
                "roll_code": "ROL-2026-SLVDG02",
                "title": "Japanese Shuttle Loom Red-Line Selvedge Denim 13.5oz — Deep Indigo",
                "composition": "100% Ring Spun Zimbabwe Cotton",
                "gsm": 450,
                "width_inches": Decimal("32.00"),
                "color_name": "Deep Midnight Indigo",
                "color_hex": "#1A237E",
                "pattern": "3/1 Right Hand Shuttle Twill",
                "finish": "Raw Unwashed Loomstate with Red-Line Edge",
                "total_yards": Decimal("140.00"),
                "available_yards": Decimal("140.00"),
                "min_cut_length_yards": Decimal("10.00"),
                "price_per_yard": Decimal("650.00"),
                "lot_batch_number": "HM-SLV-009",
                "quality_grade": "GRADE_A",
                "defect_notes": "Pure vintage shuttle-woven edge. No slub errors. Overrun from Tokyo premium capsule project.",
                "is_custom_profile": True,
                "target_buyer": buyer_company,
                "buyer_spec_notes": "Unwashed raw red-line selvedge with authentic shuttle loom self-edge. Reserved batch for Dhaka Trendz bespoke denim collection.",
                "images": [
                    "https://images.unsplash.com/photo-1582533561751-ef6f6ab93a2e?auto=format&fit=crop&w=1000&q=80",
                    "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=1000&q=80",
                ],
            },
            # 3. Beximco -> Custom Fabric Profile for New Silk Test Boutique (Mulberry Silk Georgette)
            {
                "factory": factories[2],
                "fabric_type": type_silk_georgette,
                "roll_code": "ROL-2026-SILK03",
                "title": "100% Pure Mulberry Silk Crepe Georgette — Crimson Rose",
                "composition": "100% Mulberry Grade 6A Silk",
                "gsm": 85,
                "width_inches": Decimal("44.00"),
                "color_name": "Crimson Rose",
                "color_hex": "#9B111E",
                "pattern": "Crepe Twist Georgette Weave",
                "finish": "Sand-Washed Peach Handfeel",
                "total_yards": Decimal("90.00"),
                "available_yards": Decimal("90.00"),
                "min_cut_length_yards": Decimal("5.00"),
                "price_per_yard": Decimal("850.00"),
                "lot_batch_number": "BX-SILK-401",
                "quality_grade": "GRADE_A",
                "defect_notes": "Even crepe grain, low luster matte sheen. Export balance from luxury Parisian couture order.",
                "is_custom_profile": True,
                "target_buyer": silk_buyer_company,
                "buyer_spec_notes": "Pure mulberry silk with crepe twist yarn, dyed using low-impact Swiss dyestuffs. Exclusive festive drop formulated for New Silk Boutique.",
                "images": [
                    "https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=1000&q=80",
                    "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1000&q=80",
                ],
            },
            # 4. Beximco -> Custom Fabric Profile for Dhaka Trendz Boutique (Damask Brocade)
            {
                "factory": factories[2],
                "fabric_type": type_jacquard,
                "roll_code": "ROL-2026-JACQ04",
                "title": "Royal Damask Floral Jacquard Brocade — Champagne Gold",
                "composition": "70% Viscose Rayon, 20% Silk, 10% Metallic Lurex",
                "gsm": 280,
                "width_inches": Decimal("48.00"),
                "color_name": "Champagne Gold",
                "color_hex": "#D4AF37",
                "pattern": "Jacquard Damask Floral",
                "finish": "Calendared Luster Finish",
                "total_yards": Decimal("80.00"),
                "available_yards": Decimal("80.00"),
                "min_cut_length_yards": Decimal("5.00"),
                "price_per_yard": Decimal("920.00"),
                "lot_batch_number": "BX-JAC-102",
                "quality_grade": "GRADE_A",
                "defect_notes": "Flawless electronic jacquard warp tension. Zero pull threads.",
                "is_custom_profile": True,
                "target_buyer": buyer_company,
                "buyer_spec_notes": "Intricate metallic lurex warp and micro-filament weft woven on Jacquard electronic looms. Specially formulated for Dhaka Trendz luxury wedding sherwani and lehenga collection.",
                "images": [
                    "https://images.unsplash.com/photo-1509319117193-57bab727e09d?auto=format&fit=crop&w=1000&q=80",
                    "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1000&q=80",
                ],
            },
            # 5. Beximco -> Public Surplus Roll (European Flax Linen)
            {
                "factory": factories[2],
                "fabric_type": type_linen,
                "roll_code": "ROL-2026-LINN05",
                "title": "Belgian Pure European Flax Linen Weave — Raw Sand",
                "composition": "100% Pure Normandy Flax Linen",
                "gsm": 185,
                "width_inches": Decimal("56.00"),
                "color_name": "Raw Sand",
                "color_hex": "#D2B48C",
                "pattern": "Plain Linen Weave",
                "finish": "Enzyme Washed Pre-Shrunk",
                "total_yards": Decimal("210.00"),
                "available_yards": Decimal("210.00"),
                "min_cut_length_yards": Decimal("10.00"),
                "price_per_yard": Decimal("540.00"),
                "lot_batch_number": "BX-LIN-880",
                "quality_grade": "GRADE_A",
                "defect_notes": "Export overrun from European luxury designer resort line. Pure flax slub texture, pre-washed for zero shrinkage.",
                "is_custom_profile": False,
                "images": [
                    "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?auto=format&fit=crop&w=1000&q=80",
                    "https://images.unsplash.com/photo-1528459801416-a9e53bbf4e17?auto=format&fit=crop&w=1000&q=80",
                ],
            },
            # 6. Square Fashions -> Public Surplus Roll (Bamboo Loopback Terry)
            {
                "factory": factories[0],
                "fabric_type": type_bamboo_terry,
                "roll_code": "ROL-2026-BAMB06",
                "title": "Organic Bamboo Cotton Loopback French Terry — Warm Terracotta",
                "composition": "70% Bamboo Viscose, 30% Organic Combed Cotton",
                "gsm": 320,
                "width_inches": Decimal("64.00"),
                "color_name": "Warm Terracotta",
                "color_hex": "#CC5A36",
                "pattern": "Loopback Terry",
                "finish": "Micro-Brushed Skin Touch",
                "total_yards": Decimal("165.00"),
                "available_yards": Decimal("165.00"),
                "min_cut_length_yards": Decimal("10.00"),
                "price_per_yard": Decimal("390.00"),
                "lot_batch_number": "SQ-BAM-552",
                "quality_grade": "GRADE_A",
                "defect_notes": "GOTS and OEKO-TEX Class 1 certified. Ultra soft loopback interior, exported for Scandinavian sustainable loungewear.",
                "is_custom_profile": False,
                "images": [
                    "https://images.unsplash.com/photo-1598300042247-d088f8ab3a91?auto=format&fit=crop&w=1000&q=80",
                    "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=80",
                ],
            },
            # 7. Square Fashions -> Public Surplus Roll (Modal Spandex Rib)
            {
                "factory": factories[0],
                "fabric_type": type_modal_rib,
                "roll_code": "ROL-2026-MRIB07",
                "title": "Micro-Modal Spandex 2x2 Rib Knit — Dusty Blush",
                "composition": "95% Lenzing Modal, 5% Roica Elastane",
                "gsm": 230,
                "width_inches": Decimal("58.00"),
                "color_name": "Dusty Blush",
                "color_hex": "#D8A49B",
                "pattern": "2x2 Elastic Rib",
                "finish": "Silicon Softener & Anti-Static",
                "total_yards": Decimal("110.00"),
                "available_yards": Decimal("110.00"),
                "min_cut_length_yards": Decimal("8.00"),
                "price_per_yard": Decimal("360.00"),
                "lot_batch_number": "SQ-RIB-301",
                "quality_grade": "GRADE_A",
                "defect_notes": "Silky hand with 4-way elasticity. Surplus from premium athleisure capsule.",
                "is_custom_profile": False,
                "images": [
                    "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=1000&q=80",
                    "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=1000&q=80",
                ],
            },
            # 8. Ha-Meem -> Public Surplus Roll (Indigo Slub Chambray)
            {
                "factory": factories[1],
                "fabric_type": type_chambray,
                "roll_code": "ROL-2026-CHMB08",
                "title": "Mercerized Indigo Slub Chambray 4.5oz — Sky Blue",
                "composition": "100% Combed Compact Cotton",
                "gsm": 155,
                "width_inches": Decimal("58.00"),
                "color_name": "Sky Indigo",
                "color_hex": "#5B84B1",
                "pattern": "Plain Weave Cross-Hatch Slub",
                "finish": "Mercerized & Soft Tumbler Washed",
                "total_yards": Decimal("240.00"),
                "available_yards": Decimal("240.00"),
                "min_cut_length_yards": Decimal("15.00"),
                "price_per_yard": Decimal("290.00"),
                "lot_batch_number": "HM-CHM-891",
                "quality_grade": "GRADE_A",
                "defect_notes": "Authentic yarn-dyed indigo warp with bleached white slub weft. Overrun from Ralph Lauren summer casual shirt export program.",
                "is_custom_profile": False,
                "images": [
                    "https://images.unsplash.com/photo-1551803091-e20673f15770?auto=format&fit=crop&w=1000&q=80",
                    "https://images.unsplash.com/photo-1582533561751-ef6f6ab93a2e?auto=format&fit=crop&w=1000&q=80",
                ],
            },
            # 9. Ha-Meem -> Public Surplus Roll (Supima Waffle Pique)
            {
                "factory": factories[1],
                "fabric_type": type_waffle,
                "roll_code": "ROL-2026-WAFL09",
                "title": "Supima Cotton Heavy Honeycomb Waffle Knit — Pitch Black",
                "composition": "100% Supima Long Staple Cotton",
                "gsm": 340,
                "width_inches": Decimal("60.00"),
                "color_name": "Pitch Black",
                "color_hex": "#111827",
                "pattern": "3D Honeycomb Waffle Pique",
                "finish": "Thermal Pre-Shrunk & Bio-Polished",
                "total_yards": Decimal("130.00"),
                "available_yards": Decimal("130.00"),
                "min_cut_length_yards": Decimal("10.00"),
                "price_per_yard": Decimal("420.00"),
                "lot_batch_number": "HM-WAF-412",
                "quality_grade": "GRADE_A",
                "defect_notes": "100% Supima Cotton 3D honeycomb waffle knit. Thermal retention tested, pre-shrunk and silicon softened.",
                "is_custom_profile": False,
                "images": [
                    "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?auto=format&fit=crop&w=1000&q=80",
                    "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=1000&q=80",
                ],
            },
            # 10. Beximco -> Custom Fabric Profile for Dhaka Trendz Boutique (Lustrous Silk Satin)
            {
                "factory": factories[2],
                "fabric_type": type_silk_satin,
                "roll_code": "ROL-2026-SATN10",
                "title": "Lustrous Silk Satin Charmeuse — Midnight Emerald",
                "composition": "100% Mulberry Filament Silk",
                "gsm": 95,
                "width_inches": Decimal("45.00"),
                "color_name": "Midnight Emerald",
                "color_hex": "#0D382B",
                "pattern": "Liquid Satin Charmeuse",
                "finish": "High Gloss Calendering",
                "total_yards": Decimal("75.00"),
                "available_yards": Decimal("75.00"),
                "min_cut_length_yards": Decimal("5.00"),
                "price_per_yard": Decimal("880.00"),
                "lot_batch_number": "BX-SAT-901",
                "quality_grade": "GRADE_A",
                "defect_notes": "Immaculate satin sheen, zero thread distortion. Export grade luxury silk.",
                "is_custom_profile": True,
                "target_buyer": buyer_company,
                "buyer_spec_notes": "High-twist filament silk satin with fluid liquid drape. Specially formulated and dyed in Dhaka Trendz signature midnight emerald for evening couture gowns.",
                "images": [
                    "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=1000&q=80",
                    "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1000&q=80",
                ],
            },
        ]

        for r in rolls_data:
            images = r.pop("images", [])
            roll, created = FabricRoll.objects.get_or_create(
                roll_code=r["roll_code"],
                defaults=r,
            )
            if not created:
                for k, v in r.items():
                    setattr(roll, k, v)
                roll.save()

            # Seed images
            for idx, img_url in enumerate(images):
                is_pri = idx == 0
                img_obj, img_created = FabricRollImage.objects.get_or_create(
                    fabric_roll=roll,
                    sort_order=idx,
                    defaults={"image_url": img_url, "is_primary": is_pri},
                )
                if not img_created:
                    img_obj.image_url = img_url
                    img_obj.is_primary = is_pri
                    img_obj.save()

        # Fix any existing rolls from previous migrations that had 404 images
        denim_404_roll = FabricRoll.objects.filter(roll_code="ROL-2026-DN819").first()
        if denim_404_roll:
            for img in denim_404_roll.images.all():
                img.image_url = "https://images.unsplash.com/photo-1582533561751-ef6f6ab93a2e?auto=format&fit=crop&w=1000&q=80"
                img.save()

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully seeded {len(rolls_data)} Dami fabric profiles with verified textile imagery!"
            )
        )
