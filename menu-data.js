// menu-data.js
// Data menu, brand, opsi kustomisasi, dan konfigurasi toko diletakkan terpisah agar mudah dikelola.
// Edit nilai name, price, group, brand, dan kategori di sini.

const STORE_CONFIG_DATA = {
  // Ganti 'false' menjadi 'true' jika ingin menutup toko secara spesifik
  isKopkenClosed: true, // <-- Saklar khusus Kopi Kenangan
  isForeClosed: false,   // <-- Saklar khusus Fore Coffee
  
  manualClosedMessage: "Maaf, saat ini toko sedang tutup sementara. Silakan kembali lagi nanti.",
  autoJumatan: true 
};

const BRANDS_DATA = [
  {
    id: "kopi-kenangan",
    label: "Kopi Kenangan",
    shortLabel: "Kopi Kenangan",
    description: "Promo Kenangan dan menu favorit jasdor.",
    accent: "#d94b3d",
    categories: [
      { id: "promo-50k", title: "Promo 50K" },
      { id: "promo-60k", title: "Promo 60K" },
      { id: "promo-70k", title: "Promo 70K" },
      { id: "baru", title: "Baru!" },
      { id: "coffee", title: "Coffee" },
      { id: "non-coffee", title: "Non Coffee" },
      { id: "oatside-series", title: "Oatside Series" },
      { id: "kenangan-frappe", title: "Kenangan Frappe" },
      { id: "chef-martin", title: "Chef Martin Praja's Bake" },
      { id: "kenangan-toast", title: "Kenangan Toast" },
      { id: "food", title: "Food" },
    ],
  },
  {
    id: "tomoro",
    hidden: false, // Sembunyikan Tomoro sementara dari tab brand
    label: "Tomoro Coffee",
    shortLabel: "Tomoro",
    description: "Template menu Tomoro dengan opsi susu dan topping.",
    accent: "#2b7a78",
    categories: [
      { id: "Matcha-Series", title: "Matcha Series" },
      { id: "signature", title: "Signature" },
      { id: "classic-coffee", title: "Classic Coffee" },
      { id: "flavored-latte", title: "Flavored Latte" },
      { id: "refreshing-series", title: "Refreshing Series" },
      { id: "non-coffee", title: "Non Coffee" },
    ],
    defaultOptions: [
      {
        key: "cupSize",
        label: "Cup Size",
        options: [
          { value: "Small", label: "Small" },
        ],
      },
      {
        key: "temperature",
        label: "Temperature",
        options: [
          { value: "Ice", label: "Ice", icon: "ice" },
        ],
      },
      {
        key: "sweetness",
        label: "Sweetness",
        options: [
          { value: "Normal Sweet", label: "Normal Sweet" },
          { value: "Less Sweet", label: "Less Sweet" },
        ],
      },
      {
        key: "milk",
        label: "Milk",
        options: [
          { value: "Master Milk", label: "Master Milk" },
          { value: "Oat Milk", label: "Oat Milk", priceDelta: 10000 },
          { value: "Coconut Milk", label: "Coconut Milk", priceDelta: 10000 },
        ],
      },
      {
        key: "topping",
        label: "Topping",
        options: [
          { value: "No Topping", label: "No Topping" },
          { value: "Sea Salt Cloud", label: "Sea Salt Cloud", priceDelta: 5000 },
          { value: "Cheese Cloud", label: "Cheese Cloud", priceDelta: 5000 },
          { value: "Whipping Cream", label: "Whipping Cream", priceDelta: 5000 },
        ],
      },
    ],
  },
  {
    id: "fore",
    label: "Fore Coffee",
    shortLabel: "Fore",
    description: "Template menu Fore dengan opsi espresso dan dairy.",
    accent: "#1d8f5f",
    categories: [
      { id: "sunny-burst-series", title: "Sunny Burst Series" },
      { id: "fore-signature", title: "Fore Signature" },
      { id: "coffee-of-the-day", title: "Coffee of the Day" },
      { id: "coffee", title: "Coffee" },
      { id: "americano-series", title: "Americano Series" },
      { id: "non-coffee", title: "Non Coffee" },
      { id: "fore-junior", title: "Fore Junior" },
      { id: "fore-deli", title: "Fore Deli" },
      { id: "refresher", title: "Refresher" },
      { id: "ice-blended", title: "Ice Blended" },
      { id: "tea", title: "Tea" },
    ],
    // Ubah harga item Fore di MENU_ITEMS_DATA dan opsi tambahan di defaultOptions di bawah.
    defaultOptions: [
      {
        key: "temperature",
        label: "Temperature",
        options: [
          { value: "Ice", label: "Ice", icon: "ice" },
          { value: "Hot", label: "Hot", icon: "hot" },
        ],
      },
      {
        key: "cupSize",
        label: "Ukuran Cup",
        options: [
          { value: "Reguler", label: "Reguler" },
          { value: "Large", label: "Large", priceDelta: 7000 },
        ],
      },
      {
        key: "sweetness",
        label: "Sweetness",
        options: [
          { value: "Normal Sweet", label: "Normal Sweet" },
          { value: "Less Sweet", label: "Less Sweet" },
        ],
      },
      {
        key: "iceCube",
        label: "Ice Cube",
        options: [
          { value: "Normal Ice", label: "Normal Ice" },
          { value: "Less Ice", label: "Less Ice" },
          { value: "More Ice", label: "More Ice" },
          { value: "No Ice", label: "No Ice" },
        ],
      },
      {
        key: "espresso",
        label: "Espresso",
        options: [
          { value: "Normal Shot", label: "Normal Shot" },
          { value: "+1 Shot", label: "+1 Shot", priceDelta: 7000 },
          { value: "+2 Shot", label: "+2 Shot", priceDelta: 14000 },
        ],
      },
      {
        key: "dairy",
        label: "Dairy",
        options: [
          { value: "Milk", label: "Milk" },
          { value: "Oat Milk", label: "Oat Milk", priceDelta: 15000 },
          { value: "Almond Milk", label: "Almond Milk", priceDelta: 15000 },
          { value: "Soy Multigrain", label: "Soy Multigrain", priceDelta: 7000 },
        ],
      },
    ],
  },
];

const MENU_ITEMS_DATA = [

// ==========================================
  // KATEGORI PROMO 50K (Total 8 Paket)
  // ==========================================
  { 
    id: "bundle-50k-1", group: "promo-50k", name: "Paket 50K 1", desc: "Vanilla Latte + Choco Chip Cookies + Sugar Donut (Bisa Ganti Item)", 
    oldPrice: 50000, price: 33000, color: "#bd6427",
    bundleImages: ["menu_34.jpg", "menu_119.jpg", "menu_116.jpg"],
    // 👇 TAMBAHKAN BAGIAN INI UNTUK KUSTOMISASI MANUAL 👇
    options: [
      // ===================================
      // PENGATURAN ITEM 1
      // ===================================
      {
        key: "minuman1",
        label: "Pilihan Minuman 1",
        options: [
          { value: "(Sesuai Paket) Vanilla Latte", label: "(Sesuai Paket) Vanilla Latte" },
          { value: "Ganti Mocha Caramel", label: "Ganti Mocha Caramel" },
          { value: "Ganti Caramel Latte", label: "Ganti Caramel Latte" },
          { value: "Ganti Hazelnut Latte", label: "Ganti Hazelnut Latte" },
          { value: "Ganti Matcha Espresso", label: "Ganti Matcha Espresso" },
          { value: "Ganti Milk Oreo Crumble", label: "Ganti Milk Oreo Crumble" },
          { value: "Ganti Oreo Shake", label: "Ganti Oreo Shake" },
          { value: "Ganti Dutch Chocolate", label: "Ganti Dutch Chocolate" }
        ]
      },
      {
        key: "ice1",
        label: "Ice Level (Minuman 1)",
        options: [
          { value: "Normal Ice", label: "Normal Ice" },
          { value: "Less Ice", label: "Less Ice" },
          { value: "No Ice", label: "No Ice" }
        ]
      },
      {
        key: "sugar1",
        label: "Sugar Level (Minuman 1)",
        options: [
          { value: "Normal Sugar", label: "Normal Sugar" },
          { value: "Less Sugar", label: "Less Sugar" }
        ]
      },

      // ===================================
      // PENGATURAN ITEM 2
      // ===================================
      {
        key: "makanan2",
        label: "Pilihan Makanan 2",
        options: [
          { value: "(Sesuai Paket) Choco Chip Cookies", label: "(Sesuai Paket) Choco Chip Cookies" }
        ]
      },

      // ===================================
      // PENGATURAN ITEM 3 (Contoh Makanan)
      // ===================================
      {
        key: "makanan3",
        label: "Pilihan Makanan",
        options: [
          { value: "(Sesuai Paket) Sugar Donut", label: "(Sesuai Paket) Sugar Donut" }
        ]
      }
    ]
    // 👆 SAMPAI SINI 👆
  },

{ 
    id: "bundle-50k-2", group: "promo-50k", name: "Paket 50K 2", desc: "Milk Tea + Americano + Puff (Bisa Ganti Item)", 
    oldPrice: 50000, price: 32000, color: "#bf8a56",
    bundleImages: ["menu_68.jpg", "menu_40.jpg", "menu_96.jpg"],
    
    // 👇 KUSTOMISASI BUNDLE FULL LENGKAP 👇
    options: [
      // ===================================
      // PENGATURAN ITEM 1
      // ===================================
      {
        key: "minuman1",
        label: "Pilihan Minuman 1",
        options: [
          { value: "Sesuai Paket (Kenangan Milk Tea)", label: "Sesuai Paket (Kenangan Milk Tea)" },
          { value: "Ganti OG Aren Speculoos Latte", label: "Ganti OG Aren Speculoos Latte" },
          { value: "Ganti Toffee Nut Aren Latte", label: "Ganti Toffee Nut Aren Latte" },
          { value: "Ganti Kopi Susu Black Aren", label: "Ganti Kopi Susu Black Aren" }
        ]
      },
      {
        key: "ice1",
        label: "Ice Level (Minuman 1)",
        options: [
          { value: "Normal Ice", label: "Normal Ice" },
          { value: "Less Ice", label: "Less Ice" },
          { value: "No Ice", label: "No Ice" }
        ]
      },
      {
        key: "sugar1",
        label: "Sugar Level (Minuman 1)",
        options: [
          { value: "Normal Sugar", label: "Normal Sugar" },
          { value: "Less Sugar", label: "Less Sugar" }
        ]
      },

      // ===================================
      // PENGATURAN ITEM 2
      // ===================================
      {
        key: "minuman2",
        label: "Pilihan Minuman 2",
        options: [
          { value: "Americano (Sesuai Paket)", label: "Americano (Sesuai Paket)" },
          { value: "Ganti Fresh Lemonade", label: "Ganti Fresh Lemonade" },
          { value: "Ganti Lemon Black Tea", label: "Ganti Lemon Black Tea" }
        ]
      },
      {
        key: "ice2",
        label: "Ice Level (Minuman 2)",
        options: [
          { value: "Normal Ice", label: "Normal Ice" },
          { value: "Less Ice", label: "Less Ice" }
        ]
      },
      // (Bisa tambah Sugar Level 2 di sini jika perlu)

      // ===================================
      // PENGATURAN ITEM 3 (Contoh Makanan)
      // ===================================
      {
        key: "makanan3",
        label: "Pilihan Makanan",
        options: [
          { value: "Strawberry Choux Puff (Sesuai Paket)", label: "Strawberry Choux Puff (Sesuai Paket)" },
          { value: "Ganti Chocolate Choux Puff", label: "Ganti Chocolate Choux Puff" },
          { value: "Ganti Salt Bread Choco Butter", label: "Ganti Salt Bread Choco Butter" }
        ]
      }
    ]
    // 👆 SAMPAI SINI 👆
  },
  { 
        id: "bundle-50k-3", group: "promo-50k", name: "Paket 50K 3", desc: "Kopi Kenangan Mantan + Babyccino + Chocolate Choux Puff (Bisa Ganti Item)", 
    oldPrice: 50000, price: 31500, color: "#bf8a56",
    bundleImages: ["menu_20.jpg", "menu_65.jpg", "menu_103.jpg"],
    
    // 👇 KUSTOMISASI BUNDLE FULL LENGKAP 👇
    options: [
      // ===================================
      // PENGATURAN ITEM 1
      // ===================================
      {
        key: "minuman1",
        label: "Pilihan Minuman 1",
        options: [
          { value: "Sesuai Paket (Kopi Kenangan Mantan)", label: "Sesuai Paket (Kopi Kenangan Mantan)" },
          { value: "Ganti Toffee Nut Latte", label: "Ganti Toffee Nut Latte" },
          { value: "Ganti Pistachio Aren Latte", label: "Ganti Pistachio Aren Latte" },
          { value: "Ganti Spanish Latte", label: "Ganti Spanish Latte" },
          { value: "Ganti OG Thai Tea", label: "Ganti OG Thai Tea" },
          { value: "Ganti Choco Caramel", label: "Ganti Choco Caramel" },
          { value: "Ganti Babyccino", label: "Ganti Babyccino" },
          { value: "Ganti Blueberry Americano", label: "Ganti Blueberry Americano" }
        ]
      },
      {
        key: "ice1",
        label: "Ice Level (Minuman 1)",
        options: [
          { value: "Normal Ice", label: "Normal Ice" },
          { value: "Less Ice", label: "Less Ice" },
          { value: "No Ice", label: "No Ice" }
        ]
      },
      {
        key: "sugar1",
        label: "Sugar Level (Minuman 1)",
        options: [
          { value: "Normal Sugar", label: "Normal Sugar" },
          { value: "Less Sugar", label: "Less Sugar" }
        ]
      },

      // ===================================
      // PENGATURAN ITEM 2
      // ===================================
      {
        key: "minuman2",
        label: "Pilihan Minuman 2",
        options: [
          { value: "Babyccino (Sesuai Paket)", label: "Babyccino (Sesuai Paket)" },
          { value: "Ganti Toffee Nut Latte", label: "Ganti Toffee Nut Latte" },
          { value: "Ganti Pistachio Aren Latte", label: "Ganti Pistachio Aren Latte" },
          { value: "Ganti Spanish Latte", label: "Ganti Spanish Latte" },
          { value: "Ganti OG Thai Tea", label: "Ganti OG Thai Tea" },
          { value: "Ganti Choco Caramel", label: "Ganti Choco Caramel" },
          { value: "Ganti Kopi Kenangan Mantan", label: "Ganti Kopi Kenangan Mantan" },
          { value: "Ganti Blueberry Americano", label: "Ganti Blueberry Americano" }
        ]
      },
      {
        key: "ice2",
        label: "Ice Level (Minuman 2)",
        options: [
          { value: "Normal Ice", label: "Normal Ice" },
          { value: "Less Ice", label: "Less Ice" }
        ]
      },
      {
        key: "sugar2",
        label: "Sugar Level (Minuman 2)",
        options: [
          { value: "Normal Sugar", label: "Normal Sugar" },
          { value: "Less Sugar", label: "Less Sugar" }
        ]
      },
      // (Bisa tambah Sugar Level 2 di sini jika perlu)

      // ===================================
      // PENGATURAN ITEM 3 (Contoh Makanan)
      // ===================================
      {
        key: "makanan3",
        label: "Pilihan Makanan",
        options: [
          { value: "Chocolate Choux Puff (Sesuai Paket)", label: "Chocolate Choux Puff (Sesuai Paket)" },
          { value: "Ganti Strawberry Choux Puff", label: "Ganti Strawberry Choux Puff" },
          { value: "Ganti Salt Bread Choco Butter", label: "Ganti Salt Bread Choco Butter" }
        ]
      }
    ]
  },
  { 
        id: "bundle-50k-4", group: "promo-50k", name: "Paket 50K 4", desc: "Tiramisu Frappe + Donut Almond + Roti Coklat Klasik (Bisa Ganti Item)", 
    oldPrice: 50000, price: 32000, color: "#bf8a56",
    bundleImages: ["menu_79.jpg", "menu_108.jpg", "menu_117.jpg"],
    
    // 👇 KUSTOMISASI BUNDLE FULL LENGKAP 👇
    options: [
      // ===================================
      // PENGATURAN ITEM 1
      // ===================================
      {
        key: "minuman1",
        label: "Pilihan Minuman 1",
        options: [
          { value: "Sesuai Paket (Tiramisu Frappe)", label: "Sesuai Paket (Tiramisu Frappe)" },
          { value: "Ganti Dua Shot Iced Shaken", label: "Ganti Dua Shot Iced Shaken" },
          { value: "Ganti Caramel Macchiato", label: "Ganti Caramel Macchiato" },
          { value: "Ganti Mocha Latte", label: "Ganti Mocha Latte" },
          { value: "Ganti Avocado Coffee", label: "Ganti Avocado Coffee" },
          { value: "Ganti Avocado Caramel", label: "Ganti Avocado Caramel" },
          { value: "Ganti Caramel Dutch Choco", label: "Ganti Caramel Dutch Choco" },
          { value: "Ganti Hazelnut Dutch Choco", label: "Ganti Hazelnut Dutch Choco" }
        ]
      },
      {
        key: "ice1",
        label: "Ice Level (Minuman 1)",
        options: [
          { value: "Normal Ice", label: "Normal Ice" },
          { value: "Less Ice", label: "Less Ice" },
          { value: "No Ice", label: "No Ice" }
        ]
      },
      {
        key: "sugar1",
        label: "Sugar Level (Minuman 1)",
        options: [
          { value: "Normal Sugar", label: "Normal Sugar" },
          { value: "Less Sugar", label: "Less Sugar" }
        ]
      },

      // ===================================
      // PENGATURAN ITEM 2
      // ===================================
      {
        key: "makanan2",
        label: "Pilihan Makanan 2",
        options: [
          { value: "Donut Almond (Sesuai Paket)", label: "Donut Almond (Sesuai Paket)" },
          { value: "Ganti Canele Original", label: "Ganti Canele Original" },
          { value: "Ganti Roti Keju Manis", label: "Ganti Roti Keju Manis" }
        ]
      },
      // (Bisa tambah Sugar Level 2 di sini jika perlu)

      // ===================================
      // PENGATURAN ITEM 3 (Contoh Makanan)
      // ===================================
      {
        key: "makanan3",
        label: "Pilihan Makanan 3",
        options: [
          { value: "Chocolate Choux Puff (Sesuai Paket)", label: "Chocolate Choux Puff (Sesuai Paket)" }
        ]
      }
    ]
  },
  { 
    id: "bundle-50k-5", group: "promo-50k", name: "Paket 50K 5", desc: "Avocado Milk + Roti Gulung Abon + Roti Coklat Klasik (Bisa Ganti Item)", 
    oldPrice: 50000, price: 33000, color: "#bf8a56",
    bundleImages: ["menu_57.jpg", "menu_99.jpg", "menu_117.jpg"],
    
    // 👇 KUSTOMISASI BUNDLE FULL LENGKAP 👇
    options: [
      // ===================================
      // PENGATURAN ITEM 1
      // ===================================
      {
        key: "minuman1",
        label: "Pilihan Minuman 1",
        options: [
          { value: "Sesuai Paket (Avocado Milk)", label: "Sesuai Paket (Avocado Milk)" },
          { value: "Ganti Thai Tea Aren", label: "Ganti Thai Tea Aren" },
          { value: "Ganti OG Aren Milky Speculoos", label: "Ganti OG Aren Milky Speculoos" },
          { value: "Ganti Susu Grass Jelly", label: "Ganti Susu Grass Jelly" }
        ]
      },
      {
        key: "ice1",
        label: "Ice Level (Minuman 1)",
        options: [
          { value: "Normal Ice", label: "Normal Ice" },
          { value: "Less Ice", label: "Less Ice" },
          { value: "No Ice", label: "No Ice" }
        ]
      },
      {
        key: "sugar1",
        label: "Sugar Level (Minuman 1)",
        options: [
          { value: "Normal Sugar", label: "Normal Sugar" },
          { value: "Less Sugar", label: "Less Sugar" }
        ]
      },

      // ===================================
      // PENGATURAN ITEM 2
      // ===================================
      {
        key: "makanan2",
        label: "Pilihan Makanan 2",
        options: [
          { value: "Roti Gulung Abon (Sesuai Paket)", label: "Roti Gulung Abon (Sesuai Paket)" },
          { value: "Ganti Aren Apple Pie", label: "Ganti Aren Apple Pie" },
          { value: "Ganti Bambang Choco Cheese", label: "Ganti Bambang Choco Cheese" },
          { value: "Ganti Friend Chip Cookie", label: "Ganti Friend Chip Cookie" }
        ]
      },
      // (Bisa tambah Sugar Level 2 di sini jika perlu)

      // ===================================
      // PENGATURAN ITEM 3 (Contoh Makanan)
      // ===================================
      {
        key: "makanan3",
        label: "Pilihan Makanan 3",
        options: [
          { value: "Roti Coklat Klasik (Sesuai Paket)", label: "Roti Coklat Klasik (Sesuai Paket)" }
        ]
      }
    ]
  },
  { 
        id: "bundle-50k-6", group: "promo-50k", name: "Paket 50K 6", desc: "Raspberry Hibiscus + Tiramisu Latte + Sugar Donut (Bisa Ganti Item)", 
    oldPrice: 50000, price: 33000, color: "#bf8a56",
    bundleImages: ["menu_71.jpg", "menu_25.jpg", "menu_116.jpg"],
    
    // 👇 KUSTOMISASI BUNDLE FULL LENGKAP 👇
    options: [
      // ===================================
      // PENGATURAN ITEM 1
      // ===================================
      {
        key: "minuman1",
        label: "Pilihan Minuman 1",
        options: [
          { value: "Sesuai Paket (Raspberry Hibiscus)", label: "Sesuai Paket (Raspberry Hibiscus)" },
          { value: "Ganti Tiramisu Latte", label: "Ganti Tiramisu Latte" },
          { value: "Ganti Butterscotch Aren Latte", label: "Ganti Butterscotch Aren Latte" }
        ]
      },
      {
        key: "ice1",
        label: "Ice Level (Minuman 1)",
        options: [
          { value: "Normal Ice", label: "Normal Ice" },
          { value: "Less Ice", label: "Less Ice" },
          { value: "No Ice", label: "No Ice" }
        ]
      },
      {
        key: "sugar1",
        label: "Sugar Level (Minuman 1)",
        options: [
          { value: "Normal Sugar", label: "Normal Sugar" },
          { value: "Less Sugar", label: "Less Sugar" }
        ]
      },

      // ===================================
      // PENGATURAN ITEM 2
      // ===================================
      {
        key: "minuman2",
        label: "Pilihan Minuman 2",
        options: [
          { value: "Sesuai Paket (Tiramisu Latte)", label: "Sesuai Paket (Tiramisu Latte)" },
          { value: "Ganti Raspberry Hibiscus", label: "Ganti Raspberry Hibiscus" },
          { value: "Ganti Butterscotch Aren Latte", label: "Ganti Butterscotch Aren Latte" }
        ]
      },
      {
        key: "ice2",
        label: "Ice Level (Minuman 2)",
        options: [
          { value: "Normal Ice", label: "Normal Ice" },
          { value: "Less Ice", label: "Less Ice" },
          { value: "No Ice", label: "No Ice" }
        ]
      },
      {
        key: "sugar2",
        label: "Sugar Level (Minuman 2)",
        options: [
          { value: "Normal Sugar", label: "Normal Sugar" },
          { value: "Less Sugar", label: "Less Sugar" }
        ]
      },
      // (Bisa tambah Sugar Level 2 di sini jika perlu)

      // ===================================
      // PENGATURAN ITEM 3 (Contoh Makanan)
      // ===================================
      {
        key: "makanan3",
        label: "Pilihan Makanan 3",
        options: [
          { value: "Sugar Donut (Sesuai Paket)", label: "Sugar Donut (Sesuai Paket)" }
        ]
      }
    ]
  },
  { 
        id: "bundle-50k-6", group: "promo-50k", name: "Paket 50K 6", desc: "Matcha Latte + Canele Aren + Sugar Donut (Bisa Ganti Item)", 
    oldPrice: 50000, price: 33000, color: "#bf8a56",
    bundleImages: ["menu_73.jpg", "menu_93.jpg", "menu_116.jpg"],
    
    // 👇 KUSTOMISASI BUNDLE FULL LENGKAP 👇
    options: [
      // ===================================
      // PENGATURAN ITEM 1
      // ===================================
      {
        key: "minuman1",
        label: "Pilihan Minuman 1",
        options: [
          { value: "Sesuai Paket (Matcha Latte)", label: "Sesuai Paket (Matcha Latte)" },
          { value: "Ganti Thai Tea Coffee", label: "Ganti Thai Tea Coffee" },
          { value: "Ganti Dua Shot OG Aren", label: "Ganti Dua Shot OG Aren" },
          { value: "Ganti Tiramisu Mocha Latte", label: "Ganti Tiramisu Mocha Latte" },
          { value: "Ganti Butterscotch Sea Salt Latte", label: "Ganti Butterscotch Sea Salt Latte" },
          { value: "Ganti Vanilla Kenangan Frappe", label: "Ganti Vanilla Kenangan Frappe" },
          { value: "Ganti Coffeeberry Frappe", label: "Ganti Coffeeberry Frappe" }
        ]
      },
      {
        key: "ice1",
        label: "Ice Level (Minuman 1)",
        options: [
          { value: "Normal Ice", label: "Normal Ice" },
          { value: "Less Ice", label: "Less Ice" },
          { value: "No Ice", label: "No Ice" }
        ]
      },
      {
        key: "sugar1",
        label: "Sugar Level (Minuman 1)",
        options: [
          { value: "Normal Sugar", label: "Normal Sugar" },
          { value: "Less Sugar", label: "Less Sugar" }
        ]
      },

      // ===================================
      // PENGATURAN ITEM 2
      // ===================================
      {
        key: "makanan2",
        label: "Pilihan Makanan 2",
        options: [
          { value: "Canele Aren (Sesuai Paket)", label: "Canele Aren (Sesuai Paket)" },
          { value: "Ganti Blueberry Muffin", label: "Ganti Blueberry Muffin" },
          { value: "Ganti Canele Toffee Nut Crumble", label: "Ganti Canele Toffee Nut Crumble" },
          { value: "Ganti Salt Bread Sausage", label: "Ganti Salt Bread Sausage" }
        ]
      },
      // (Bisa tambah Sugar Level 2 di sini jika perlu)

      // ===================================
      // PENGATURAN ITEM 3 (Contoh Makanan)
      // ===================================
      {
        key: "makanan3",
        label: "Pilihan Makanan 3",
        options: [
          { value: "Sugar Donut (Sesuai Paket)", label: "Sugar Donut (Sesuai Paket)" }
        ]
      }
    ]
  },

  // ==========================================
  // KATEGORI PROMO 60K (Total 8 Paket)
  // ==========================================
  { 
    id: "bundle-60k-1", group: "promo-60k", name: "Paket 60K 1", desc: "Caramel Macchiato + Cappuccino + Sugar Donut (Bisa Ganti Item)", 
    oldPrice: 60000, price: 36000, color: "#bf8a56",
    bundleImages: ["menu_23.jpg", "menu_41.jpg", "menu_116.jpg"],
    
    // 👇 KUSTOMISASI BUNDLE FULL LENGKAP 👇
    options: [
      // ===================================
      // PENGATURAN ITEM 1
      // ===================================
      {
        key: "minuman1",
        label: "Pilihan Minuman 1",
        options: [
          { value: "Sesuai Paket (Caramel Macchiato)", label: "Sesuai Paket (Caramel Macchiato)" },
          { value: "Ganti Dua Shot Iced Shaken", label: "Ganti Dua Shot Iced Shaken" },
          { value: "Ganti Mocha Latte", label: "Ganti Mocha Latte" },
          { value: "Ganti Avocado Coffee", label: "Ganti Avocado Coffee" },
          { value: "Ganti Avocado Caramel", label: "Ganti Avocado Caramel" },
          { value: "Ganti Caramel Dutch Choco", label: "Ganti Caramel Dutch Choco" },
          { value: "Ganti Hazelnut Dutch Choco", label: "Ganti Hazelnut Dutch Choco" },
          { value: "Ganti Tiramisu Frappe", label: "Ganti Tiramisu Frappe" }
        ]
      },
      {
        key: "ice1",
        label: "Ice Level (Minuman 1)",
        options: [
          { value: "Normal Ice", label: "Normal Ice" },
          { value: "Less Ice", label: "Less Ice" },
          { value: "No Ice", label: "No Ice" }
        ]
      },
      {
        key: "sugar1",
        label: "Sugar Level (Minuman 1)",
        options: [
          { value: "Normal Sugar", label: "Normal Sugar" },
          { value: "Less Sugar", label: "Less Sugar" }
        ]
      },

      // ===================================
      // PENGATURAN ITEM 2
      // ===================================
      {
        key: "minuman2",
        label: "Pilihan Minuman 2",
        options: [
          { value: "Sesuai Paket (Cappuccino)", label: "Sesuai Paket (Cappuccino)" },
          { value: "Ganti Toffee Nut Oat Latte", label: "Ganti Toffee Nut Oat Latte" },
          { value: "Ganti Creamy Aren Latte", label: "Ganti Creamy Aren Latte" },
          { value: "Ganti Latte", label: "Ganti Latte" },
          { value: "Ganti Toffee Nut Choco Macchiato", label: "Ganti Toffee Nut Choco Macchiato" },
          { value: "Ganti Butterscotch Sea Salt Macchiato", label: "Ganti Butterscotch Sea Salt Macchiato" },
          { value: "Ganti Hazelnut Choco Milk Tea", label: "Ganti Hazelnut Choco Milk Tea" }
        ]
      },
      {
        key: "ice2",
        label: "Ice Level (Minuman 2)",
        options: [
          { value: "Normal Ice", label: "Normal Ice" },
          { value: "Less Ice", label: "Less Ice" },
          { value: "No Ice", label: "No Ice" }
        ]
      },
      {
        key: "sugar2",
        label: "Sugar Level (Minuman 2)",
        options: [
          { value: "Normal Sugar", label: "Normal Sugar" },
          { value: "Less Sugar", label: "Less Sugar" }
        ]
      },
      // (Bisa tambah Sugar Level 2 di sini jika perlu)

      // ===================================
      // PENGATURAN ITEM 3 (Contoh Makanan)
      // ===================================
      {
        key: "makanan3",
        label: "Pilihan Makanan 3",
        options: [
          { value: "Sugar Donut (Sesuai Paket)", label: "Sugar Donut (Sesuai Paket)" }
        ]
      }
    ]
  },
  { 
        id: "bundle-60k-2", group: "promo-60k", name: "Paket 60K 2", desc: "Matcha Kenangan Frappe + Kopi Kenangan Mantan + Roti Coklat Klasik (Bisa Ganti Item)", 
    oldPrice: 60000, price: 37000, color: "#bf8a56",
    bundleImages: ["menu_81.jpg", "menu_20.jpg", "menu_117.jpg"],
    
    // 👇 KUSTOMISASI BUNDLE FULL LENGKAP 👇
    options: [
      // ===================================
      // PENGATURAN ITEM 1
      // ===================================
      {
        key: "minuman1",
        label: "Pilihan Minuman 1",
        options: [
          { value: "Sesuai Paket (Matcha Kenangan Frappe)", label: "Sesuai Paket (Matcha Kenangan Frappe)" }
        ]
      },
      {
        key: "ice1",
        label: "Ice Level (Minuman 1)",
        options: [
          { value: "Normal Ice", label: "Normal Ice" },
          { value: "Less Ice", label: "Less Ice" },
          { value: "No Ice", label: "No Ice" }
        ]
      },
      {
        key: "sugar1",
        label: "Sugar Level (Minuman 1)",
        options: [
          { value: "Normal Sugar", label: "Normal Sugar" },
          { value: "Less Sugar", label: "Less Sugar" }
        ]
      },

      // ===================================
      // PENGATURAN ITEM 2
      // ===================================
      {
        key: "minuman2",
        label: "Pilihan Minuman 2",
        options: [
          { value: "Sesuai Paket (Kopi Kenangan Mantan)", label: "Sesuai Paket (Kopi Kenangan Mantan)" },
          { value: "Ganti Toffee Nut Latte", label: "Ganti Toffee Nut Latte" },
          { value: "Ganti Pistachio Aren Latte", label: "Ganti Pistachio Aren Latte" },
          { value: "Ganti Spanish Latte", label: "Ganti Spanish Latte" },
          { value: "Ganti OG Thai Tea", label: "Ganti OG Thai Tea" },
          { value: "Ganti Choco Caramel", label: "Ganti Choco Caramel" },
          { value: "Ganti Babyccino", label: "Ganti Babyccino" },
          { value: "Ganti Blueberry Americano", label: "Ganti Blueberry Americano" }
        ]
      },
      {
        key: "ice2",
        label: "Ice Level (Minuman 2)",
        options: [
          { value: "Normal Ice", label: "Normal Ice" },
          { value: "Less Ice", label: "Less Ice" },
          { value: "No Ice", label: "No Ice" }
        ]
      },
      {
        key: "sugar2",
        label: "Sugar Level (Minuman 2)",
        options: [
          { value: "Normal Sugar", label: "Normal Sugar" },
          { value: "Less Sugar", label: "Less Sugar" }
        ]
      },
      // (Bisa tambah Sugar Level 2 di sini jika perlu)

      // ===================================
      // PENGATURAN ITEM 3 (Contoh Makanan)
      // ===================================
      {
        key: "makanan3",
        label: "Pilihan Makanan 3",
        options: [
          { value: "Roti Coklat Klasik (Sesuai Paket)", label: "Roti Coklat Klasik (Sesuai Paket)" }
        ]
      }
    ]
  },
  { 
    id: "bundle-60k-3", group: "promo-60k", name: "Paket 60K 3", desc: "Vanilla Kenangan Frappe + Hazelnut Choco Milk Tea + Roti Keju Manis (Bisa Ganti Item)", 
    oldPrice: 60000, price: 40000, color: "#bf8a56",
    bundleImages: ["menu_83.jpg", "menu_55.jpg", "menu_118.jpg"],
    
    // 👇 KUSTOMISASI BUNDLE FULL LENGKAP 👇
    options: [
      // ===================================
      // PENGATURAN ITEM 1
      // ===================================
      {
        key: "minuman1",
        label: "Pilihan Minuman 1",
        options: [
          { value: "Sesuai Paket (Vanilla Kenangan Frappe)", label: "Sesuai Paket (Vanilla Kenangan Frappe)" },
          { value: "Ganti Thai Tea Coffee", label: "Ganti Thai Tea Coffee" },
          { value: "Ganti Dua Shot OG Aren", label: "Ganti Dua Shot OG Aren" },
          { value: "Ganti Tiramisu Mocha Latte", label: "Ganti Tiramisu Mocha Latte" },
          { value: "Ganti Butterscotch Sea Salt Latte", label: "Ganti Butterscotch Sea Salt Latte" },
          { value: "Ganti Matcha Latte", label: "Ganti Matcha Latte" },
          { value: "Ganti Coffeeberry Frappe", label: "Ganti Coffeeberry Frappe" }
        ]
      },
      {
        key: "ice1",
        label: "Ice Level (Minuman 1)",
        options: [
          { value: "Normal Ice", label: "Normal Ice" },
          { value: "Less Ice", label: "Less Ice" },
          { value: "No Ice", label: "No Ice" }
        ]
      },
      {
        key: "sugar1",
        label: "Sugar Level (Minuman 1)",
        options: [
          { value: "Normal Sugar", label: "Normal Sugar" },
          { value: "Less Sugar", label: "Less Sugar" }
        ]
      },

      // ===================================
      // PENGATURAN ITEM 2
      // ===================================
      {
        key: "minuman2",
        label: "Pilihan Minuman 2",
        options: [
          { value: "Sesuai Paket (Hazelnut Choco Milk Tea)", label: "Sesuai Paket (Hazelnut Choco Milk Tea)" },
          { value: "Ganti Toffee Nut Oat Latte", label: "Ganti Toffee Nut Oat Latte" },
          { value: "Ganti Creamy Aren Latte", label: "Ganti Creamy Aren Latte" },
          { value: "Ganti Cappuccino", label: "Ganti Cappuccino" },
          { value: "Ganti Latte", label: "Ganti Latte" },
          { value: "Ganti Toffee Nut Choco Macchiato", label: "Ganti Toffee Nut Choco Macchiato" },
          { value: "Ganti Butterscotch Sea Salt Macchiato", label: "Ganti Butterscotch Sea Salt Macchiato" }
        ]
      },
      {
        key: "ice2",
        label: "Ice Level (Minuman 2)",
        options: [
          { value: "Normal Ice", label: "Normal Ice" },
          { value: "Less Ice", label: "Less Ice" },
          { value: "No Ice", label: "No Ice" }
        ]
      },
      {
        key: "sugar2",
        label: "Sugar Level (Minuman 2)",
        options: [
          { value: "Normal Sugar", label: "Normal Sugar" },
          { value: "Less Sugar", label: "Less Sugar" }
        ]
      },
      // (Bisa tambah Sugar Level 2 di sini jika perlu)

      // ===================================
      // PENGATURAN ITEM 3 (Contoh Makanan)
      // ===================================
      {
        key: "makanan3",
        label: "Pilihan Makanan 3",
        options: [
          { value: "Roti Keju Manis (Sesuai Paket)", label: "Roti Keju Manis (Sesuai Paket)" },
          { value: "Ganti Canele Original", label: "Ganti Canele Original" },
          { value: "Ganti Donut Almond", label: "Ganti Donut Almond" }
        ]
      }
    ]
  },
  { 
    id: "bundle-60k-4", group: "promo-60k", name: "Paket 60K 4", desc: "Oreo Shake + Kopi Susu Black Aren + Canele Original (Bisa Ganti Item)", 
    oldPrice: 60000, price: 37000, color: "#bf8a56",
    bundleImages: ["menu_70.jpg", "menu_31.jpg", "menu_106.jpg"],
    
    // 👇 KUSTOMISASI BUNDLE FULL LENGKAP 👇
    options: [
      // ===================================
      // PENGATURAN ITEM 1
      // ===================================
      {
        key: "minuman1",
        label: "Pilihan Minuman 1",
        options: [
          { value: "Sesuai Paket (Oreo Shake)", label: "Sesuai Paket (Oreo Shake)" },
          { value: "Ganti Mocha Caramel", label: "Ganti Mocha Caramel" },
          { value: "Ganti Caramel Latte", label: "Ganti Caramel Latte" },
          { value: "Ganti Hazelnut Latte", label: "Ganti Hazelnut Latte" },
          { value: "Ganti Matcha Espresso", label: "Ganti Matcha Espresso" },
          { value: "Ganti Vanilla Latte", label: "Ganti Vanilla Latte" },
          { value: "Ganti Milk Oreo Crumble", label: "Ganti Milk Oreo Crumble" },
          { value: "Ganti Dutch Chocolate", label: "Ganti Dutch Chocolate" }
        ]
      },
      {
        key: "ice1",
        label: "Ice Level (Minuman 1)",
        options: [
          { value: "Normal Ice", label: "Normal Ice" },
          { value: "Less Ice", label: "Less Ice" },
          { value: "No Ice", label: "No Ice" }
        ]
      },
      {
        key: "sugar1",
        label: "Sugar Level (Minuman 1)",
        options: [
          { value: "Normal Sugar", label: "Normal Sugar" },
          { value: "Less Sugar", label: "Less Sugar" }
        ]
      },

      // ===================================
      // PENGATURAN ITEM 2
      // ===================================
      {
        key: "minuman2",
        label: "Pilihan Minuman 2",
        options: [
          { value: "Sesuai Paket (Kopi Susu Black Aren)", label: "Sesuai Paket (Kopi Susu Black Aren)" },
          { value: "Ganti OG Aren Speculoos Latte", label: "Ganti OG Aren Speculoos Latte" },
          { value: "Ganti Toffee Nut Aren Latte", label: "Ganti Toffee Nut Aren Latte" },
          { value: "Ganti Kenangan Milk Tea", label: "Ganti Kenangan Milk Tea" }
        ]
      },
      {
        key: "ice2",
        label: "Ice Level (Minuman 2)",
        options: [
          { value: "Normal Ice", label: "Normal Ice" },
          { value: "Less Ice", label: "Less Ice" },
          { value: "No Ice", label: "No Ice" }
        ]
      },
      {
        key: "sugar2",
        label: "Sugar Level (Minuman 2)",
        options: [
          { value: "Normal Sugar", label: "Normal Sugar" },
          { value: "Less Sugar", label: "Less Sugar" }
        ]
      },
      // (Bisa tambah Sugar Level 2 di sini jika perlu)

      // ===================================
      // PENGATURAN ITEM 3 (Contoh Makanan)
      // ===================================
      {
        key: "makanan3",
        label: "Pilihan Makanan 3",
        options: [
          { value: "Canele Original (Sesuai Paket)", label: "Canele Original (Sesuai Paket)" },
          { value: "Ganti Roti Keju Manis", label: "Ganti Roti Keju Manis" },
          { value: "Ganti Donut Almond", label: "Ganti Donut Almond" }
        ]
      }
    ]
  },
  { 
    id: "bundle-60k-5", group: "promo-60k", name: "Paket 60K 5", desc: "Butterscotch Kenangan Frappe + Blueberry Muffin + Canele Aren (Bisa Ganti Item)", 
    oldPrice: 60000, price: 38000, color: "#bf8a56",
    bundleImages: ["menu_80.jpg", "menu_95.jpg", "menu_93.jpg"],
    
    // 👇 KUSTOMISASI BUNDLE FULL LENGKAP 👇
    options: [
      // ===================================
      // PENGATURAN ITEM 1
      // ===================================
      {
        key: "minuman1",
        label: "Pilihan Minuman 1",
        options: [
          { value: "Sesuai Paket (Butterscotch Kenangan Frappe)", label: "Sesuai Paket (Butterscotch Kenangan Frappe)" }
        ]
      },
      {
        key: "ice1",
        label: "Ice Level (Minuman 1)",
        options: [
          { value: "Normal Ice", label: "Normal Ice" },
          { value: "Less Ice", label: "Less Ice" },
          { value: "No Ice", label: "No Ice" }
        ]
      },
      {
        key: "sugar1",
        label: "Sugar Level (Minuman 1)",
        options: [
          { value: "Normal Sugar", label: "Normal Sugar" },
          { value: "Less Sugar", label: "Less Sugar" }
        ]
      },

      // ===================================
      // PENGATURAN ITEM 2
      // ===================================
      {
        key: "makanan2",
        label: "Pilihan Makanan 2",
        options: [
          { value: "Blueberry Muffin (Sesuai Paket)", label: "Blueberry Muffin (Sesuai Paket)" },
          { value: "Ganti Canele Aren", label: "Ganti Canele Aren" },
          { value: "Ganti Canele Toffee Nut Crumble", label: "Ganti Canele Toffee Nut Crumble" },
          { value: "Ganti Salt Bread Sausage", label: "Ganti Salt Bread Sausage" }
        ]
      },
      // (Bisa tambah Sugar Level 2 di sini jika perlu)

      // ===================================
      // PENGATURAN ITEM 3 (Contoh Makanan)
      // ===================================
      {
        key: "makanan3",
        label: "Pilihan Makanan 3",
        options: [
          { value: "Canele Aren (Sesuai Paket)", label: "Canele Aren (Sesuai Paket)" },
          { value: "Ganti Blueberry Muffin", label: "Ganti Blueberry Muffin" },
          { value: "Ganti Canele Toffee Nut Crumble", label: "Ganti Canele Toffee Nut Crumble" },
          { value: "Ganti Salt Bread Sausage", label: "Ganti Salt Bread Sausage" }
        ]
      }
    ]
  },
  { 
    id: "bundle-60k-6", group: "promo-60k", name: "Paket 60K 6", desc: "Thai Tea Aren + Susu Grass Jelly + Chocolate Choux Puff (Bisa Ganti Item)", 
    oldPrice: 60000, price: 37000, color: "#bf8a56",
    bundleImages: ["menu_3.jpg", "menu_72.jpg", "menu_103.jpg"],
    
    // 👇 KUSTOMISASI BUNDLE FULL LENGKAP 👇
    options: [
      // ===================================
      // PENGATURAN ITEM 1
      // ===================================
      {
        key: "minuman1",
        label: "Pilihan Minuman 1",
        options: [
          { value: "Sesuai Paket (Thai Tea Aren)", label: "Sesuai Paket (Thai Tea Aren)" },
          { value: "Ganti OG Aren Milky Speculoos", label: "Ganti OG Aren Milky Speculoos" },
          { value: "Ganti Susu Grass Jelly", label: "Ganti Susu Grass Jelly" },
          { value: "Ganti Avocado Milk", label: "Ganti Avocado Milk" }
        ]
      },
      {
        key: "ice1",
        label: "Ice Level (Minuman 1)",
        options: [
          { value: "Normal Ice", label: "Normal Ice" },
          { value: "Less Ice", label: "Less Ice" },
          { value: "No Ice", label: "No Ice" }
        ]
      },
      {
        key: "sugar1",
        label: "Sugar Level (Minuman 1)",
        options: [
          { value: "Normal Sugar", label: "Normal Sugar" },
          { value: "Less Sugar", label: "Less Sugar" }
        ]
      },

      // ===================================
      // PENGATURAN ITEM 2
      // ===================================
      {
        key: "minuman2",
        label: "Pilihan Minuman 2",
        options: [
          { value: "Sesuai Paket (Susu Grass Jelly)", label: "Sesuai Paket (Susu Grass Jelly)" },
          { value: "Ganti OG Aren Milky Speculoos", label: "Ganti OG Aren Milky Speculoos" },
          { value: "Ganti Thai Tea Aren", label: "Ganti Thai Tea Aren" },
          { value: "Ganti Avocado Milk", label: "Ganti Avocado Milk" }
        ]
      },
      {
        key: "ice2",
        label: "Ice Level (Minuman 2)",
        options: [
          { value: "Normal Ice", label: "Normal Ice" },
          { value: "Less Ice", label: "Less Ice" },
          { value: "No Ice", label: "No Ice" }
        ]
      },
      {
        key: "sugar2",
        label: "Sugar Level (Minuman 2)",
        options: [
          { value: "Normal Sugar", label: "Normal Sugar" },
          { value: "Less Sugar", label: "Less Sugar" }
        ]
      },
      // (Bisa tambah Sugar Level 2 di sini jika perlu)

      // ===================================
      // PENGATURAN ITEM 3 (Contoh Makanan)
      // ===================================
      {
        key: "makanan3",
        label: "Pilihan Makanan 3",
        options: [
          { value: "Chocolate Choux Puff (Sesuai Paket)", label: "Chocolate Choux Puff (Sesuai Paket)" },
          { value: "Ganti Strawberry Choux Puff", label: "Ganti Strawberry Choux Puff" },
          { value: "Ganti Salt Bread Choco Butter", label: "Ganti Salt Bread Choco Butter" }
        ]
      }
    ]
  },
  { 
    id: "bundle-60k-7", group: "promo-60k", name: "Paket 60K 7", desc: "Kopi Kenangan Mantan Frappe + Butterscotch Aren Latte + Donut Almond (Bisa Ganti Item)", 
    oldPrice: 60000, price: 40000, color: "#bf8a56",
    bundleImages: ["menu_82.jpg", "menu_38.jpg", "menu_108.jpg"],
    
    // 👇 KUSTOMISASI BUNDLE FULL LENGKAP 👇
    options: [
      // ===================================
      // PENGATURAN ITEM 1
      // ===================================
      {
        key: "minuman1",
        label: "Pilihan Minuman 1",
        options: [
          { value: "Sesuai Paket (Kopi Kenangan Mantan Frappe)", label: "Sesuai Paket (Kopi Kenangan Mantan Frappe)" },
          { value: "Ganti Thai Tea Loaded", label: "Ganti Thai Tea Loaded" },
          { value: "Ganti Chocoberry Frappe", label: "Ganti Chocoberry Frappe" }
        ]
      },
      {
        key: "ice1",
        label: "Ice Level (Minuman 1)",
        options: [
          { value: "Normal Ice", label: "Normal Ice" },
          { value: "Less Ice", label: "Less Ice" },
          { value: "No Ice", label: "No Ice" }
        ]
      },
      {
        key: "sugar1",
        label: "Sugar Level (Minuman 1)",
        options: [
          { value: "Normal Sugar", label: "Normal Sugar" },
          { value: "Less Sugar", label: "Less Sugar" }
        ]
      },

      // ===================================
      // PENGATURAN ITEM 2
      // ===================================
      {
        key: "minuman2",
        label: "Pilihan Minuman 2",
        options: [
          { value: "Sesuai Paket (Butterscotch Aren Latte)", label: "Sesuai Paket (Butterscotch Aren Latte)" },
          { value: "Ganti Tiramisu Latte", label: "Ganti Tiramisu Latte" },
          { value: "Ganti Raspberry Hibiscus", label: "Ganti Raspberry Hibiscus" }
        ]
      },
      {
        key: "ice2",
        label: "Ice Level (Minuman 2)",
        options: [
          { value: "Normal Ice", label: "Normal Ice" },
          { value: "Less Ice", label: "Less Ice" },
          { value: "No Ice", label: "No Ice" }
        ]
      },
      {
        key: "sugar2",
        label: "Sugar Level (Minuman 2)",
        options: [
          { value: "Normal Sugar", label: "Normal Sugar" },
          { value: "Less Sugar", label: "Less Sugar" }
        ]
      },
      // (Bisa tambah Sugar Level 2 di sini jika perlu)

      // ===================================
      // PENGATURAN ITEM 3 (Contoh Makanan)
      // ===================================
      {
        key: "makanan3",
        label: "Pilihan Makanan 3",
        options: [
          { value: "Donut Almond (Sesuai Paket)", label: "Donut Almond (Sesuai Paket)" },
          { value: "Ganti Canele Original", label: "Ganti Canele Original" },
          { value: "Ganti Roti Keju Manis", label: "Ganti Roti Keju Manis" }
        ]
      }
    ]
  },

  { 
        id: "bundle-60k-large", group: "promo-60k", name: "Paket 60K Large", desc: "Butterscotch Aren Latte LARGE + Cafe Malt Latte + Sugar Donut (Bisa Ganti Item)", 
    oldPrice: 60000, price: 41000, color: "#bf8a56",
    bundleImages: ["menu_25.jpg", "menu_19.jpg", "menu_116.jpg"],
    
    // 👇 KUSTOMISASI BUNDLE FULL LENGKAP 👇
    options: [
      // ===================================
      // PENGATURAN ITEM 1
      // ===================================
      {
        key: "minuman1",
        label: "Pilihan Minuman 1",
        options: [
          { value: "Sesuai Paket (Butterscotch Aren Latte LARGE)", label: "Sesuai Paket (Butterscotch Aren Latte LARGE)" },
          { value: "Ganti Raspberry Hibiscus LARGE", label: "Ganti Raspberry Hibiscus LARGE" }
        ]
      },
      {
        key: "ice1",
        label: "Ice Level (Minuman 1)",
        options: [
          { value: "Normal Ice", label: "Normal Ice" },
          { value: "Less Ice", label: "Less Ice" },
          { value: "No Ice", label: "No Ice" }
        ]
      },
      {
        key: "sugar1",
        label: "Sugar Level (Minuman 1)",
        options: [
          { value: "Normal Sugar", label: "Normal Sugar" },
          { value: "Less Sugar", label: "Less Sugar" }
        ]
      },

      // ===================================
      // PENGATURAN ITEM 2
      // ===================================
      {
        key: "minuman2",
        label: "Pilihan Minuman 2",
        options: [
          { value: "Sesuai Paket (Cafe Malt Latte)", label: "Sesuai Paket (Cafe Malt Latte)" },
          { value: "Ganti Milo Dinosaurus", label: "Ganti Milo Dinosaurus" },
          { value: "Ganti Blueberry Frappe", label: "Ganti Blueberry Frappe" }
        ]
      },
      {
        key: "ice2",
        label: "Ice Level (Minuman 2)",
        options: [
          { value: "Normal Ice", label: "Normal Ice" },
          { value: "Less Ice", label: "Less Ice" },
          { value: "No Ice", label: "No Ice" }
        ]
      },
      {
        key: "sugar2",
        label: "Sugar Level (Minuman 2)",
        options: [
          { value: "Normal Sugar", label: "Normal Sugar" },
          { value: "Less Sugar", label: "Less Sugar" }
        ]
      },
      // (Bisa tambah Sugar Level 2 di sini jika perlu)

      // ===================================
      // PENGATURAN ITEM 3 (Contoh Makanan)
      // ===================================
      {
        key: "makanan3",
        label: "Pilihan Makanan 3",
        options: [
          { value: "Sugar Donut (Sesuai Paket)", label: "Sugar Donut (Sesuai Paket)" }
        ]
      }
    ]
  },

  // ==========================================
  // KATEGORI PROMO 70K (Total 8 Paket)
  // ==========================================
  { 
    id: "bundle-70k-1", group: "promo-70k", name: "Paket Sultan 70K 1 (Avocado Caramel + Mocha Latte + Choco Chip Cookies)", 
    oldPrice: 70000, price: 44000, kind: "food", color: "#afc94f",
    bundleImages: ["menu_56.jpg", "menu_33.jpg", "menu_119.jpg"] 
  },
  { 
    id: "bundle-70k-2", group: "promo-70k", name: "Paket Sultan 70K 2 (Matcha Kenangan Frappe + Caramel Dutch Choco + Sugar Donut)", 
    oldPrice: 70000, price: 43000, kind: "food", color: "#69a63b",
    bundleImages: ["menu_81.jpg", "menu_58.jpg", "menu_116.jpg"] 
  },
  { 
    id: "bundle-70k-3", group: "promo-70k", name: "Paket Sultan 70K 3 (Caramel Dutch Choco + Thai Tea Coffee + Danish Tiramisu)", 
    oldPrice: 70000, price: 45000, kind: "food", color: "#6b3326",
    bundleImages: ["menu_59.jpg", "menu_4.jpg", "menu_104.jpg"] 
  },
  { 
    id: "bundle-70k-4", group: "promo-70k", name: "Paket Sultan 70K 4 (Butterscotch Kenangan Frappe + Milo Dino + Bambang Choco Cheese)", 
    oldPrice: 70000, price: 46000, kind: "food", color: "#d59a32",
    bundleImages: ["menu_80.jpg", "menu_69.jpg", "menu_109.jpg"] 
  },
  { 
    id: "bundle-70k-5", group: "promo-70k", name: "Paket Sultan 70K 5 (Dutch Choco Kenangan Frappe + Toffee Nut Oat Latte + Chocolate Croissant)", 
    oldPrice: 70000, price: 45000, kind: "food", color: "#5a2d25",
    bundleImages: ["menu_84.jpg", "menu_29.jpg", "menu_115.jpg"] 
  },
  { 
    id: "bundle-70k-6", group: "promo-70k", name: "Paket Sultan 70K 6 (Thai Tea Loaded + Milk Oreo Crumble + Aren Apple Pie)", 
    oldPrice: 70000, price: 43000, kind: "food", color: "#cf6b20",
    bundleImages: ["menu_50.jpg", "menu_64.jpg", "menu_94.jpg"] 
  },
  { 
    id: "bundle-70k-7", group: "promo-70k", name: "Paket Sultan 70K 7 (Caramel Macchiato + Avocado Coffee + Choco Chip Cookies)", 
    oldPrice: 70000, price: 43000, kind: "food", color: "#bd6a2d",
    bundleImages: ["menu_23.jpg", "menu_35.jpg", "menu_119.jpg"] 
  },

  // Kategori: Baru!
  { 
    id: "blueberry-americano", 
    group: "baru", 
    name: "Blueberry Americano", 
    oldPrice: 19000, 
    price: 12500, 
    largePrice: 19500, 
    jumboPrice: 29500, 
    allowOatside: false, 
    allowBeans: true, 
    noSugar: false, 
    color: "#e56d17", 
    foam: "#fff1df", 
    drizzle: "#d35c19", 
    isNew: true, 
    noHot: true, 
    isBestSeller: true, 
    onlyNormalIce: true 
  },

  { 
    id: "blueberry-frappe", 
    group: "baru", 
    name: "Blueberry Frappe", 
    oldPrice: 23000, 
    price: 14500, 
    largePrice: 21500, 
    jumboPrice: 31500, 
    allowOatside: false, 
    allowBeans: false, 
    noSugar: false, 
    color: "#e56d17", 
    foam: "#fff1df", 
    drizzle: "#d35c19", 
    isNew: true, 
    noHot: true, 
    isBestSeller: true, 
    onlyNormalIce: true 
  },

{ 
    id: "chocoberry-frappe", 
    group: "baru", 
    name: "Chocoberry Frappe", 
    oldPrice: 27000, 
    price: 16500, 
    largePrice: 23500, 
    jumboPrice: 33500, 
    allowOatside: true, 
    allowBeans: false, 
    noSugar: false, 
    color: "#e56d17", 
    foam: "#fff1df", 
    drizzle: "#d35c19", 
    isNew: true, 
    noHot: true, 
    isBestSeller: true, 
    onlyNormalIce: true 
  },

  {
    id: "coffeeberry-frappe", 
    group: "baru", 
    name: "Coffeeberry Frappe", 
    oldPrice: 25000, 
    price: 15500, 
    largePrice: 22500, 
    jumboPrice: 32500, 
    allowOatside: false, 
    allowBeans: true, 
    noSugar: false, 
    color: "#e56d17", 
    foam: "#fff1df", 
    drizzle: "#d35c19", 
    isNew: true, 
    noHot: true, 
    isBestSeller: true, 
    onlyNormalIce: true 
  },

  {
    id: "salt-bread-choco-butter", 
    group: "baru", 
    name: "Salt Bread Choco Butter", 
    kind: "food",
    oldPrice: 12000, 
    price: 9000, 
    isNew: true, 
    isBestSeller: true
  },

   {
    id: "salt-bread-sausage", 
    group: "baru", 
    name: "Salt Bread Sausage", 
    kind: "food",
    oldPrice: 15000, 
    price: 10500, 
    isNew: true, 
    isBestSeller: true
  },

  // Kategori: Coffee
  { id: "thai-tea-coffee-coffee", group: "coffee", name: "Thai Tea Coffee", oldPrice: 25000, price: 15500, largePrice: 15500, jumboPrice: 22500, allowBeans: true, allowOatside: true, color: "#7d3d1d", foam: "#f6d6ab", drizzle: "#e27521", isNew: true, noRegular: true, noSugar: true },
  { id: "og-aren-speculoos-latte", group: "coffee", name: "OG Aren Speculoos Latte", oldPrice: 21000, price: 14500, largePrice: 21500, allowBeans: true, allowOatside: true, color: "#d2a06b", foam: "#fff2dc", drizzle: "#9a5a28" },
  { id: "dua-shot-og-aren", group: "coffee", name: "Dua Shot OG Aren", oldPrice: 25000, price: 16500, largePrice: 23500, allowBeans: true, allowOatside: true, noSugar: true, color: "#d7a36c", foam: "#fff2dc", drizzle: "#76401f" },
  { id: "mocha-caramel", group: "coffee", name: "Mocha Caramel", oldPrice: 26000, price: 17000, largePrice: 24000, jumboPrice: 34000, allowBeans: true, allowOatside: true, noSugar: true, color: "#70402c", foam: "#f4dcc4", drizzle: "#3b1c12" },
  { id: "cafe-malt-latte", group: "coffee", name: "Cafe Malt Latte", oldPrice: 23000, price: 15500, largePrice: 22500, color: "#2f2922", foam: "#e2c696", drizzle: "#b17a37" },
  { id: "kopi-kenangan-mantan", group: "coffee", name: "Kopi Kenangan Mantan", isBestSeller: true, oldPrice: 19000, price: 12500, largePrice: 18500, jumboPrice: 28500, allowBeans: true, allowOatside: true, color: "#8d4a27", foam: "#f3d3b1", drizzle: "#5d2d19" },
  { id: "caramel-latte", group: "coffee", name: "Caramel Latte", oldPrice: 26000, price: 16000, largePrice: 24000, jumboPrice: 33000, allowBeans: true, allowOatside: true, color: "#b45b23", foam: "#fff0dc", drizzle: "#a04b19" },
  { id: "dua-shot-iced-shaken", group: "coffee", name: "Dua Shot Iced Shaken", oldPrice: 28000, price: 17000, largePrice: 27000, jumboPrice: 36000, allowBeans: true, allowOatside: true, noHot: true, color: "#d56419", foam: "#ffe4c6", drizzle: "#ee8d24" },
  { id: "caramel-macchiato", group: "coffee", name: "Caramel Macchiato", oldPrice: 28000, price: 17000, largePrice: 27000, jumboPrice: 36000, allowBeans: true, allowOatside: true, color: "#bd6a2d", foam: "#fff2dc", drizzle: "#a75a20" },
  { id: "hazelnut-latte", group: "coffee", name: "Hazelnut Latte", oldPrice: 26000, price: 16000, largePrice: 24000, jumboPrice: 33000, allowBeans: true, allowOatside: true, color: "#9f562a", foam: "#f4dfc8", drizzle: "#7a3b1e" },
  { id: "tiramisu-latte", group: "coffee", name: "Tiramisu Latte", oldPrice: 20000, price: 13500, largePrice: 17500, jumboPrice: 21500, allowBeans: true, allowOatside: true, color: "#a16643", foam: "#f7efe6", drizzle: "#6d3b24" },
  { id: "tiramisu-mocha-latte", group: "coffee", name: "Tiramisu Mocha Latte", oldPrice: 25000, price: 16500, largePrice: 21000, jumboPrice: 25500, allowBeans: true, allowOatside: true, color: "#6e3a2b", foam: "#f7efe6", drizzle: "#3a1c13" },
  { id: "toffee-nut-latte", group: "coffee", name: "Toffee Nut Latte", oldPrice: 19000, price: 13000, largePrice: 20000, jumboPrice: 30000, allowBeans: true, allowOatside: false, noSugar: true, color: "#b36e3a", foam: "#f3d7b9", drizzle: "#815029" },
  { id: "toffee-nut-aren-latte", group: "coffee", name: "Toffee Nut Aren Latte", oldPrice: 21000, price: 14500, largePrice: 21500, jumboPrice: 31500, allowBeans: true, allowOatside: false, color: "#9f5127", foam: "#f0cda9", drizzle: "#5f2d17" },
  { id: "toffee-nut-oat-latte", group: "coffee", name: "Toffee Nut Oat Latte", oldPrice: 22000, price: 15000, largePrice: 22000, jumboPrice: 32000, allowBeans: true, allowOatside: false, noSugar: true, color: "#b98351", foam: "#f1dcc4", drizzle: "#775032" },
  { id: "pistachio-aren-latte", group: "coffee", name: "Pistachio Aren Latte", oldPrice: 19000, price: 13000, largePrice: 20000, jumboPrice: 30000, allowBeans: true, allowOatside: true, noSugar: true, color: "#95bb49", foam: "#d9efae", drizzle: "#4e6128" },
  { id: "kopi-susu-black-aren", group: "coffee", name: "Kopi Susu Black Aren", oldPrice: 21000, price: 13500, largePrice: 22500, jumboPrice: 31500, allowBeans: true, allowOatside: true, color: "#57301e", foam: "#ddb689", drizzle: "#1f0f09" },
  { id: "matcha-espresso", group: "coffee", name: "Matcha Espresso", oldPrice: 26000, price: 16000, largePrice: 25000, jumboPrice: 35000, allowBeans: true, allowOatside: true, color: "#6a7a38", foam: "#d7e5a1", drizzle: "#35451b" },
  { id: "mocha-latte", group: "coffee", name: "Mocha Latte", oldPrice: 28000, price: 17000, largePrice: 27000, jumboPrice: 36000, allowBeans: true, allowOatside: true, color: "#89502c", foam: "#f4dcc4", drizzle: "#4f2718" },
  { id: "vanilla-latte", group: "coffee", name: "Vanilla Latte", oldPrice: 26000, price: 16000, largePrice: 24000, jumboPrice: 33000, allowBeans: true, allowOatside: true, color: "#bd6427", foam: "#fff3de", drizzle: "#edc77e" },
  { id: "avocado-coffee", group: "coffee", name: "Avocado Coffee", oldPrice: 28000, price: 17000, largePrice: 27000, jumboPrice: 36000, allowBeans: true, allowOatside: true, color: "#6d7d3d", foam: "#c8df88", drizzle: "#3f5528" },
  { id: "spanish-latte", group: "coffee", name: "Spanish Latte", oldPrice: 19000, price: 12500, largePrice: 20500, jumboPrice: 29500, allowBeans: true, allowOatside: false, noSugar: true, color: "#a25a2a", foam: "#f8efe4", drizzle: "#d7a16b" },
  { id: "creamy-aren-latte", group: "coffee", name: "Creamy Aren Latte", oldPrice: 22000, price: 14000, largePrice: 23000, jumboPrice: 32000, allowBeans: true, allowOatside: false, noSugar: true, color: "#8f4a24", foam: "#f1dbc5", drizzle: "#6c341b" },
  { id: "butterscotch-aren-latte", group: "coffee", name: "Butterscotch Aren Latte", oldPrice: 20000, price: 14000, largePrice: 21000, jumboPrice: 30000, allowBeans: true, allowOatside: true, noSugar: true, color: "#b46b2d", foam: "#f3d2a7", drizzle: "#81501e" },
  { id: "butterscotch-sea-salt-latte", group: "coffee", name: "Butterscotch Sea Salt Latte", isBestSeller: true, oldPrice: 25000, price: 15500, largePrice: 23500, jumboPrice: 32500, allowBeans: true, allowOatside: true, noSugar: true, color: "#bd6426", foam: "#fff1d9", drizzle: "#c68a47" },
  { id: "americano", group: "coffee", name: "Americano", oldPrice: 17000, price: 11500, largePrice: 16500, jumboPrice: 23500, allowBeans: true, allowOatside: false, color: "#3f2016", foam: "#5a3020", drizzle: "#2a120c" },
  { id: "cappuccino", group: "coffee", name: "Cappuccino", oldPrice: 22000, price: 14000, largePrice: 21000, jumboPrice: 30000, allowBeans: true, allowOatside: true, color: "#b4612c", foam: "#fff3e5", drizzle: "#c98c52" },
  { id: "latte", group: "coffee", name: "Latte", oldPrice: 22000, price: 14000, largePrice: 21000, jumboPrice: 30000, allowBeans: true, allowOatside: true, color: "#c06a31", foam: "#fff0df", drizzle: "#dfb07e" },

  // Kategori: Non-Coffee
  { id: "nc-og-thai-tea", group: "non-coffee", name: "OG Thai Tea", oldPrice: 19000, price: 12500, largePrice: 16500, jumboPrice: 23500, allowOatside: false, noSugar: true, color: "#e56d17", foam: "#fff1df", drizzle: "#d35c19", isNew: true, noHot: false },
  { id: "nc-thai-tea-loaded", group: "non-coffee", name: "Thai Tea Loaded", isBestSeller: false, oldPrice: 27000, price: 16000, largePrice: 16500, allowBeans: false, allowOatside: false, noSugar: true, color: "#cf6b20", foam: "#fff4e5", drizzle: "#5b2f1b", noRegular: true, noHot: true },
  { id: "nc-thai-tea-aren", group: "non-coffee", name: "Thai Tea Aren", oldPrice: 24000, price: 15000, largePrice: 15000, jumboPrice: 22000, allowBeans: false, allowOatside: false, color: "#bd5b1d", foam: "#f4d09c", drizzle: "#7c3f1f", isNew: true, noSugar: true, noRegular: true },
  { id: "og-aren-milky-speculoos", group: "non-coffee", name: "OG Aren Milky Speculoos", oldPrice: 23000, price: 16000, largePrice: 16000, jumboPrice: 23000, allowBeans: false, allowOatside: false, color: "#d7a36c", foam: "#fff2dc", drizzle: "#76401f", noSugar: true, noRegular: true },
  { id: "choco-caramel", group: "non-coffee", name: "Choco Caramel", oldPrice: 19000, price: 13000, largePrice: 20000, jumboPrice: 30000, allowOatside: true, color: "#71402c", foam: "#f5d4bd", drizzle: "#3b1c12", noSugar: true },
  { id: "toffee-nut-choco-macchiato", group: "non-coffee", name: "Toffee Nut Choco Macchiato", oldPrice: 22000, price: 15000, allowBeans: false, allowOatside: true, color: "#7a4027", foam: "#f0d1a6", drizzle: "#b17428", noSugar: true },
  { id: "butterscotch-sea-salt-macchiato", group: "non-coffee", name: "Butterscotch Sea Salt Macchiato", soldOutUntil: "2026-12-30T17:00",isBestSeller: false, oldPrice: 22000, price: 15000, allowBeans: false, allowOatside: true, color: "#e3bd82", foam: "#fff3db", drizzle: "#bd7b32" },
  { id: "milk-oreo-crumble", group: "non-coffee", name: "Milk Oreo Crumble", oldPrice: 26000, price: 17000, allowBeans: false, allowOatside: true, color: "#f6f2e9", foam: "#ffffff", drizzle: "#111111", noHot: true },
  { id: "babyccino", group: "non-coffee", name: "Babyccino", oldPrice: 19000, price: 13000, allowBeans: false, allowOatside: true, color: "#f0dfc2", foam: "#fff8ef", drizzle: "#bc7b28" },
  { id: "fresh-lemonade", group: "non-coffee", name: "Fresh Lemonade", oldPrice: 17000, price: 11500, largePrice: 11500, jumboPrice: 21500, allowOatside: false, color: "#f4d23c", foam: "#fff2a5", drizzle: "#e6aa18", noHot: true, noRegular: true },
  { id: "lemon-black-tea", group: "non-coffee", name: "Lemon Black Tea", oldPrice: 17000, price: 11500, largePrice: 18500, jumboPrice: 25500, allowBeans: false, allowOatside: false, color: "#ba3b2f", foam: "#f4d66b", drizzle: "#6a1f18" },
  { id: "kenangan-milk-tea", group: "non-coffee", name: "Kenangan Milk Tea", oldPrice: 21000, price: 14500, largePrice: 20500, jumboPrice: 27500, allowBeans: false, allowOatside: false, color: "#bf8a56", foam: "#f3d9bd", drizzle: "#875022" },
  { id: "milo-dinosaurus", group: "non-coffee", name: "Milo Dinosaurus", oldPrice: 23000, price: 15500, largePrice: 30000, jumboPrice: 30500, allowBeans: false, allowOatside: false, color: "#6c3e2f", foam: "#e5c6ad", drizzle: "#3a2017" },
  { id: "oreo-shake", group: "non-coffee", name: "Oreo Shake", oldPrice: 26000, price: 17000, largePrice: 25000, jumboPrice: 35000, allowBeans: false, allowOatside: true, color: "#f1eee7", foam: "#ffffff", drizzle: "#111111", noHot: true },
  { id: "raspberry-hibiscus", group: "non-coffee", name: "Raspberry Hibiscus", oldPrice: 20000, price: 14000, largePrice: 21000, jumboPrice: 28000, allowBeans: false, allowOatside: false, color: "#df253c", foam: "#f48ba0", drizzle: "#b91529" },
  { id: "susu-grass-jelly", group: "non-coffee", name: "Susu Grass Jelly", oldPrice: 24000, price: 16000, largePrice: 24000, jumboPrice: 33000, allowBeans: false, allowOatside: true, color: "#d3aa73", foam: "#f3dfbd", drizzle: "#111111", noHot: true },
  { id: "matcha-latte", group: "non-coffee", name: "Matcha Latte", oldPrice: 25000, price: 17500, largePrice: 24500, jumboPrice: 34500, allowOatside: true, color: "#4f9c3c", foam: "#d7efb1", drizzle: "#2f5f24" },
  { id: "hazelnut-choco-milk-tea", group: "non-coffee", name: "Hazelnut Choco Milk Tea", oldPrice: 22000, price: 15000, largePrice: 22000, jumboPrice: 29000, allowBeans: false, allowOatside: false, color: "#8b4a32", foam: "#e8c3a2", drizzle: "#5a2b1e" },
  { id: "avocado-caramel", group: "non-coffee", name: "Avocado Caramel", oldPrice: 28000, price: 18000, largePrice: 28000, jumboPrice: 37000, allowBeans: false, allowOatside: true, color: "#afc94f", foam: "#edf5b1", drizzle: "#d79327", noHot: true },
  { id: "avocado-milk", group: "non-coffee", name: "Avocado Milk", oldPrice: 24000, price: 16000, largePrice: 26000, jumboPrice: 35000, allowBeans: false, allowOatside: true, color: "#b4cf49", foam: "#eff6bd", drizzle: "#7f9c2d", noHot: true },
  { id: "caramel-dutch-choco", group: "non-coffee", name: "Caramel Dutch Choco", oldPrice: 28000, price: 18000, largePrice: 28000, jumboPrice: 37000, allowBeans: false, allowOatside: true, color: "#603225", foam: "#f0c9a8", drizzle: "#b66a20" },
  { id: "dutch-chocolate", group: "non-coffee", name: "Dutch Chocolate", oldPrice: 26000, price: 17000, largePrice: 27000, jumboPrice: 36000, allowBeans: false, allowOatside: true, color: "#6b3326", foam: "#e7c2a8", drizzle: "#39180f" },
  { id: "hazelnut-dutch-choco", group: "non-coffee", name: "Hazelnut Dutch Choco", oldPrice: 28000, price: 18000, largePrice: 28000, jumboPrice: 37000, allowBeans: false, allowOatside: true, color: "#78422b", foam: "#e8c6a9", drizzle: "#4c2217" },

  // Kategori Frappe
  { id: "tiramisu-frappe", group: "kenangan-frappe", name: "Tiramisu Frappe", oldPrice: 28000, price: 18000, largePrice: 18000, jumboPrice: 22000, allowBeans: true, allowOatside: true, color: "#6d3b2a", foam: "#f6efe7", drizzle: "#3a1c12", kind: "frappe", noHot: true },
  { id: "butterscotch-kenangan-frappe", group: "kenangan-frappe", name: "Butterscotch Kenangan Frappe", oldPrice: 30000, price: 20000, largePrice: 30000, allowBeans: true, allowOatside: true, color: "#d59a32", foam: "#fff3df", drizzle: "#b36a1f", kind: "frappe", noHot: true },
  { id: "matcha-kenangan-frappe", group: "kenangan-frappe", name: "Matcha Kenangan Frappe", oldPrice: 32000, price: 20000, largePrice: 30000, allowBeans: false, allowOatside: true, color: "#69a63b", foam: "#dcf0b3", drizzle: "#2f5d22", kind: "frappe", noHot: true },
  { id: "kopi-kenangan-mantan-frappe", group: "kenangan-frappe", name: "Kopi Kenangan Mantan Frappe", oldPrice: 27000, price: 18500, largePrice: 25500, allowBeans: true, allowOatside: true, color: "#9f5a2f", foam: "#f2dfcf", drizzle: "#5e2d17", kind: "frappe", noHot: true },
  { id: "vanilla-kenangan-frappe", group: "kenangan-frappe", name: "Vanilla Kenangan Frappe", oldPrice: 25000, price: 17500, largePrice: 24500, allowBeans: false, allowOatside: true, color: "#f5f0e7", foam: "#ffffff", drizzle: "#e5d4bb", kind: "frappe", noHot: true },
  { id: "dutch-choco-kenangan-frappe", group: "kenangan-frappe", name: "Dutch Choco Kenangan Frappe", oldPrice: 29000, price: 19500, largePrice: 26500, allowBeans: false, allowOatside: true, color: "#5a2d25", foam: "#e9c4ad", drizzle: "#28110c", kind: "frappe", noHot: true },

  // Kategori: Makanan
  { id: "canele-aren", group: "chef-martin", name: "Canele Aren", oldPrice: 15000, price: 10500, kind: "food", color: "#6b3a24" },
  { id: "aren-apple-pie", group: "chef-martin", name: "Aren Apple Pie", oldPrice: 17000, price: 11500, kind: "food", color: "#d59441" },
  { id: "blueberry-muffin", group: "chef-martin", name: "Blueberry Muffin", oldPrice: 15000, price: 10500, kind: "food", color: "#d7a85b" },
  { id: "strawberry-choux-puff", group: "chef-martin", name: "Strawberry Choux Puff", oldPrice: 12000, price: 9000, kind: "food", color: "#e6a06c" },
  { id: "chocolate-choux-puff", group: "chef-martin", name: "Chocolate Choux Puff", oldPrice: 12000, price: 9000, kind: "food", color: "#6b3726" },
  { id: "danish-tiramisu", group: "chef-martin", name: "Danish Tiramisu", oldPrice: 19000, price: 13000, kind: "food", color: "#7b4a2f" },
  { id: "salt-bread-original", group: "chef-martin", name: "Salt Bread Original", oldPrice: 11000, price: 9000, kind: "food", color: "#d9913c" },
  { id: "canele-original", group: "chef-martin", name: "Canele Original", oldPrice: 13000, price: 9500, kind: "food", color: "#7a432b" },
  { id: "canele-toffee-nut-crumble", group: "chef-martin", name: "Canele Toffee Nut Crumble", oldPrice: 15000, price: 10500, kind: "food", color: "#8b4a32" },
  { id: "donut-almond", group: "chef-martin", name: "Donut Almond", oldPrice: 13000, price: 9500, kind: "food", color: "#d7a15b" },
  { id: "roti-gulung-abon", group: "chef-martin", name: "Roti Gulung Abon", oldPrice: 17000, price: 12500, kind: "food", color: "#c0702e" },
  
  { id: "bambang-choco-cheese", group: "kenangan-toast", name: "Bambang Choco Cheese", oldPrice: 17000, price: 13500, kind: "toast", color: "#d58a35" },
 
  { id: "chocolate-croissant", group: "food", name: "Chocolate Croissant", oldPrice: 19000, price: 14500, kind: "food", color: "#c6782d" },
  { id: "sugar-donut", group: "food", name: "Sugar Donut", oldPrice: 10000, price: 8000, kind: "food", color: "#e4b56c" },
  { id: "roti-coklat-klasik", group: "food", name: "Roti Coklat Klasik", oldPrice: 9000, price: 7500, kind: "food", color: "#8a4328" },
  { id: "roti-keju-manis", group: "food", name: "Roti Keju Manis", oldPrice: 13000, price: 10000, kind: "food", color: "#ead7aa" },
  { id: "choco-chip-cookies", group: "food", name: "Choco Chip Cookies", oldPrice: 14000, price: 12000, kind: "cookie", color: "#bb7a37" },
  { id: "join-the-dark-side-cookie", group: "food", name: "Join the Dark Side Cookie", oldPrice: 21000, price: 15500, kind: "cookie", color: "#3d2119" },
  { id: "friend-chip-cookie", group: "food", name: "Friend Chip Cookie", oldPrice: 17000, price: 13500, kind: "cookie", color: "#c99050" },

  // ==========================================
  // TEMPLATE TOMORO COFFEE
  // Foto otomatis dicari dengan format: tomoro-nama-menu.jpg
  // Contoh: assets/menu/tomoro-tomoro-latte.jpg
  // ==========================================
  
// --- GROUP: Matcha-Series ---
{ id: "tomoro-matcha-caramel-coffee-mousse", brand: "tomoro", group: "Matcha-Series", name: "Matcha Caramel Coffee Mousse", oldPrice: 26000, price: 19000 },
{ id: "tomoro-matcha-jasmine-milk-tea", brand: "tomoro", group: "Matcha-Series", name: "Matcha Jasmine Milk Tea", oldPrice: 23000, price: 18000 },
{ id: "tomoro-matcha-espresso", brand: "tomoro", group: "Matcha-Series", name: "Matcha Espresso", oldPrice: 30000, price: 23000 },
{ id: "tomoro-pistachio-matcha-latte", brand: "tomoro", group: ["Matcha-Series", "signature"], name: "Pistachio Matcha Latte", oldPrice: 29000, price: 21500 },
{ id: "tomoro-sea-salt-cloud-matcha-latte", brand: "tomoro", group: ["Matcha-Series", "signature","cloud-series"], name: "Sea Salt Cloud Matcha Latte", oldPrice: 30000, price: 23000 },
{ id: "tomoro-matcha-latte", brand: "tomoro", group: ["Matcha-Series", "non-coffee"], name: "Matcha Latte", oldPrice: 27000, price: 21000 },
{ id: "tomoro-matcha-oat-latte", brand: "tomoro", group: ["Matcha-Series", "non-coffee"], name: "Matcha Oat Latte", oldPrice: 28000, price: 21000 },
{ id: "tomoro-strawberry-matcha-latte", brand: "tomoro", group: "Matcha-Series", name: "Strawberry Matcha Latte", oldPrice: 30000, price: 23000 },

// --- GROUP: signature ---
{ id: "tomoro-aren-latte", brand: "tomoro", group: "signature", name: "TOMORO Aren Latte", oldPrice: 21000, price: 15000 },
{ id: "tomoro-oat-latte", brand: "tomoro", group: "signature", name: "TOMORO Oat Latte", oldPrice: 24000, price: 18000 },
{ id: "tomoro-cheese-cloud-chocolate", brand: "tomoro", group: "signature", name: "Cheese Cloud Chocolate", oldPrice: 26000, price: 19000 },

// --- GROUP: Classic coffee ---
{ id: "tomoro-caffe-americano", brand: "tomoro", group: "classic-coffee", name: "Caffe Americano", oldPrice: 18000, price: 13000 },
{ id: "tomoro-breve-latte", brand: "tomoro", group: "classic-coffee", name: "Breve Latte", oldPrice: 30000, price: 22000 },
{ id: "tomoro-caffe-latte", brand: "tomoro", group: "classic-coffee", name: "Caffe Latte", oldPrice: 24000, price: 18000 },
{ id: "tomoro-kopi-susu-aren", brand: "tomoro", group: "classic-coffee", name: "Kopi Susu Aren", oldPrice: 18000, price: 14500 },
{ id: "tomoro-caffe-mocha", brand: "tomoro", group: "classic-coffee", name: "Caffe Mocha", oldPrice: 25000, price: 18000 },
{ id: "tomoro-cappuccino", brand: "tomoro", group: "classic-coffee", name: "Cappuccino", oldPrice: 24000, price: 18000 },

// --- GROUP: flavored latte  ---
{ id: "tomoro-pistachio-latte", brand: "tomoro", group: "flavored-latte", name: "Pistachio Latte", oldPrice: 26000, price: 19000 },
{ id: "tomoro-caramel-macchiato", brand: "tomoro", group: "flavored-latte", name: "Caramel Macchiato", oldPrice: 26000, price: 19000 },
{ id: "tomoro-cheese-cloud-latte", brand: "tomoro", group: "flavored-latte", name: "Cheese Cloud Latte", oldPrice: 26000, price: 19000 },
{ id: "tomoro-caramel-cheese-latte", brand: "tomoro", group: "flavored-latte", name: "Caramel Cheese Latte", oldPrice: 26000, price: 19000 },
{ id: "tomoro-spanish-latte", brand: "tomoro", group: "flavored-latte", name: "Spanish Latte", oldPrice: 25000, price: 18000 },
{ id: "tomoro-spanish-aren-latte", brand: "tomoro", group: "flavored-latte", name: "Spanish Aren Latte", oldPrice: 26000, price: 19000 },
{ id: "tomoro-coconut-aren-latte", brand: "tomoro", group: "flavored-latte", name: "Coconut Aren Latte", oldPrice: 25000, price: 18000 },
{ id: "tomoro-tomoro-coconut-latte", brand: "tomoro", group: "flavored-latte", name: "TOMORO Coconut Latte", oldPrice: 23000, price: 18000 },
{ id: "tomoro-manuka-oat-latte", brand: "tomoro", group: "flavored-latte", name: "Manuka Oat Latte", oldPrice: 30000, price: 21000 },

// --- GROUP: refreshing series  ---
{ id: "tomoro-strawberry-americano", brand: "tomoro", group: "refreshing-series", name: "Strawberry Americano", oldPrice: 19000, price: 15000 },
{ id: "tomoro-lemonade-americano", brand: "tomoro", group: "refreshing-series", name: "Lemonade Americano", oldPrice: 20000, price: 15000 },
{ id: "tomoro-strawberry-jasmine-tea", brand: "tomoro", group: "refreshing-series", name: "Strawberry Jasmine Tea", oldPrice: 19000, price: 15000 },
{ id: "tomoro-peach-americano", brand: "tomoro", group: "refreshing-series", name: "Peach Americano", oldPrice: 19000, price: 14000 },
{ id: "tomoro-peach-jasmine-tea", brand: "tomoro", group: "refreshing-series", name: "Peach Jasmine Tea", oldPrice: 19000, price: 14000 },
{ id: "tomoro-pink-pop-lemonade", brand: "tomoro", group: "refreshing-series", name: "Pink Pop Lemonade", oldPrice: 14000, price: 11000 },
{ id: "tomoro-pink-pop-lemon-tea", brand: "tomoro", group: "refreshing-series", name: "Pink Pop Lemon Tea", oldPrice: 17000, price: 13500 },
{ id: "tomoro-grapefruit-americano", brand: "tomoro", group: "refreshing-series", name: "Grapefruit Americano", oldPrice: 20000, price: 15000 },

// --- GROUP: non-coffee ---
{ id: "tomoro-pistachio-chocolate", brand: "tomoro", group: "non-coffee", name: "Pistachio Chocolate", oldPrice: 26000, price: 19000 },
{ id: "tomoro-sea-salt-cloud-chocolate", brand: "tomoro", group: "non-coffee", name: "Sea Salt Cloud Chocolate", oldPrice: 28000, price: 20500 },
{ id: "tomoro-hojicha-oat-latte", brand: "tomoro", group: "non-coffee", name: "Hojicha Oat Latte", oldPrice: 30000, price: 22000 },
{ id: "tomoro-chocolate", brand: "tomoro", group: "non-coffee", name: "Chocolate", oldPrice: 24000, price: 17000 },
{ id: "tomoro-choco-oat-latte", brand: "tomoro", group: "non-coffee", name: "Choco Oat Latte", oldPrice: 28000, price: 21000 },
{ id: "tomoro-peach-oolong-milk-tea", brand: "tomoro", group: "non-coffee", name: "Peach Oolong Milk Tea", oldPrice: 19000, price: 14500 },

  // ==========================================
  // TEMPLATE FORE COFFEE
  // Foto otomatis dicari dengan format: fore-nama-menu.jpg
  // Contoh: assets/menu/fore-pandan-latte.jpg
  // ==========================================
  {
    id: "fore-orange-cream-toffee-latte",
    brand: "fore",
    group: "sunny-burst-series",
    name: "Orange Cream Toffee Latte",
    oldPrice: 33000,
    price: 27000,
  },
  {
    id: "fore-sunrise-mont-black",
    brand: "fore",
    group: "sunny-burst-series",
    name: "Sunrise Mont-Black",
    oldPrice: 29000,
    price: 24000,
  },
  {
    id: "fore-kopi-dari-tani",
    brand: "fore",
    group: "fore-signature",
    name: "Kopi Dari Tani",
    oldPrice: 25000,
    price: 21000,
  },
  {
    id: "fore-butterscotch-sea-salt-latte",
    brand: "fore",
    group: "fore-signature",
    name: "Butterscotch Sea Salt Latte",
    oldPrice: 33000,
    price: 27000,
  },
  {
    id: "fore-buttercream-latte",
    brand: "fore",
    group: "fore-signature",
    name: "Buttercream Latte",
    oldPrice: 33000,
    price: 27000,
  },
  {
    id: "fore-aren-latte",
    brand: "fore",
    group: "fore-signature",
    name: "Aren Latte",
    oldPrice: 29000,
    price: 24000,
  },
  {
    id: "fore-pandan-latte",
    brand: "fore",
    group: "fore-signature",
    name: "Pandan Latte",
    oldPrice: 29000,
    price: 24000,
  },
  {
    id: "fore-dirty-matchapresso",
    brand: "fore",
    group: "coffee",
    name: "Dirty Matchapresso",
    oldPrice: 31000,
    price: 25500,
  },
  {
    id: "fore-malty-latte",
    brand: "fore",
    group: "coffee",
    name: "Malty Latte",
    oldPrice: 27000,
    price: 22500,
  },
  {
    id: "fore-bumi-latte",
    brand: "fore",
    group: "coffee",
    name: "Bumi Latte",
    oldPrice: 25000,
    price: 21000,
  },
  {
    id: "fore-cappucino",
    brand: "fore",
    group: "coffee",
    name: "Cappucino",
    oldPrice: 29000,
    price: 24000,
  },
  {
    id: "fore-double-iced-shaken-latte",
    brand: "fore",
    group: "coffee",
    name: "Double Iced Shaken Latte",
    oldPrice: 33000,
    price: 27000,
  },
  {
    id: "fore-cafe-latte",
    brand: "fore",
    group: "coffee",
    name: "Cafe Latte",
    oldPrice: 29000,
    price: 24000,
  },
  {
    id: "fore-nutty-oat-latte",
    brand: "fore",
    group: "coffee",
    name: "Nutty Oat Latte",
    oldPrice: 39000,
    price: 31500,
  },
  {
    id: "fore-buttercream-tiramisu-latte",
    brand: "fore",
    group: "coffee",
    name: "Buttercream Tiramisu Latte",
    oldPrice: 34000,
    price: 27750,
  },
  {
    id: "fore-espresso",
    brand: "fore",
    group: "coffee",
    name: "Espresso",
    oldPrice: 21000,
    price: 18000,
  },
  {
    id: "fore-caramel-praline-macchiato",
    brand: "fore",
    group: "coffee",
    name: "Caramel Praline Macchiato",
    oldPrice: 34000,
    price: 27750,
  },
  {
    id: "fore-americano",
    brand: "fore",
    group: "americano-series",
    name: "Americano",
    oldPrice: 23000,
    price: 19500,
  },
  {
    id: "fore-manuka-americano",
    brand: "fore",
    group: "americano-series",
    name: "Manuka Americano",
    oldPrice: 29000,
    price: 24000,
  },
  {
    id: "fore-triple-peach-americano",
    brand: "fore",
    group: "americano-series",
    name: "Triple Peach Americano",
    oldPrice: 29000,
    price: 24000,
  },
  {
    id: "fore-berry-manuka-americano",
    brand: "fore",
    group: "americano-series",
    name: "Berry Manuka Americano",
    oldPrice: 31000,
    price: 25500,
  },
  {
    id: "fore-matcha-butter-salt-cream",
    brand: "fore",
    group: "non-coffee",
    name: "Matcha Butter Salt Cream",
    oldPrice: 31000,
    price: 25500,
  },
  {
    id: "fore-dark-chocolate",
    brand: "fore",
    group: "non-coffee",
    name: "Dark Chocolate",
    oldPrice: 34000,
    price: 27750,
  },
  {
    id: "fore-almond-choco",
    brand: "fore",
    group: "non-coffee",
    name: "Almond Choco",
    oldPrice: 39000,
    price: 31500,
  },
  {
    id: "fore-matcha-green-tea",
    brand: "fore",
    group: "non-coffee",
    name: "Matcha Green Tea",
    oldPrice: 34000,
    price: 27750,
  },
  {
    id: "fore-classic-milo",
    brand: "fore",
    group: "non-coffee",
    name: "Classic Milo",
    oldPrice: 25000,
    price: 21000,
  },
  {
    id: "fore-choco-cookie-shake",
    brand: "fore",
    group: "fore-junior",
    name: "Choco Cookie Shake",
    oldPrice: 29000,
    price: 24000,
  },
  {
    id: "fore-butterscotch-milk-crumble",
    brand: "fore",
    group: "fore-junior",
    name: "Butterscotch Milk Crumble",
    oldPrice: 29000,
    price: 24000,
  },
  {
    id: "fore-vanilla-o-crumbs",
    brand: "fore",
    group: "fore-junior",
    name: "Vanilla O` Crumbs",
    oldPrice: 29000,
    price: 24000,
  },
  {
    id: "fore-choco-caramel-cloud",
    brand: "fore",
    group: "fore-junior",
    name: "Choco Caramel Cloud",
    oldPrice: 29000,
    price: 24000,
  },
  {
    id: "fore-mushroom-truffle-sandwich",
    brand: "fore",
    group: "fore-deli",
    name: "Mushroom Truffle Sandwich",
    oldPrice: 42000,
    price: 33750,
  },
  {
    id: "fore-roll-cake-cheese-pandan",
    brand: "fore",
    group: "fore-deli",
    name: "Roll Cake Cheese Pandan",
    oldPrice: 27000,
    price: 22500,
  },
  {
    id: "fore-roll-cake-Peanut-Butter-Jam",
    brand: "fore",
    group: "fore-deli",
    name: "Roll Cake Peanut Butter & Jam",
    oldPrice: 27000,
    price: 22500,
  },
  {
    id: "fore-roll-cake-mocha",
    brand: "fore",
    group: "fore-deli",
    name: "Roll Cake Mocha",
    oldPrice: 27000,
    price: 22500,
  },
  {
    id: "fore-beef-mentai-sandwich",
    brand: "fore",
    group: "fore-deli",
    name: "Beef Mentai Sandwich",
    oldPrice: 39000,
    price: 31500,
  },
  {
    id: "fore-cheesy-tuna-sandwich",
    brand: "fore",
    group: "fore-deli",
    name: "Cheesy Tuna Sandwich",
    oldPrice: 39000,
    price: 31500,
  },
  {
    id: "fore-chicken-teriyaki-sandwich",
    brand: "fore",
    group: "fore-deli",
    name: "Chicken Teriyaki Sandwich",
    oldPrice: 39000,
    price: 31500,
  },
  {
    id: "fore-smoked-beef-cheese-sandwich",
    brand: "fore",
    group: "fore-deli",
    name: "Smoked Beef & Cheese Sandwich",
    oldPrice: 39000,
    price: 31500,
  },
  {
    id: "fore-blueberry-cheese-muffin",
    brand: "fore",
    group: "fore-deli",
    name: "Blueberry Cheese Muffin",
    oldPrice: 36000,
    price: 29250,
  },
  {
    id: "fore-choco-melt-muffin",
    brand: "fore",
    group: "fore-deli",
    name: "Choco Melt Muffin",
    oldPrice: 36000,
    price: 29250,
  },
  {
    id: "fore-almond-croissant",
    brand: "fore",
    group: "fore-deli",
    name: "Almond Croissant",
    oldPrice: 36000,
    price: 29250,
  },
  {
    id: "fore-banana-chocolate-cake",
    brand: "fore",
    group: "fore-deli",
    name: "Banana Chocolate Cake",
    oldPrice: 27000,
    price: 22500,
  },
  {
    id: "fore-butter-croissant",
    brand: "fore",
    group: "fore-deli",
    name: "Butter Croissant",
    oldPrice: 24000,
    price: 20250,
  },
  {
    id: "fore-pain-au-chocolat",
    brand: "fore",
    group: "fore-deli",
    name: "Pain au Chocolat",
    oldPrice: 29000,
    price: 24000,
  },
  {
    id: "fore-hibiscus-lychee-peach-yakult",
    brand: "fore",
    group: "refresher",
    name: "Hibiscus Lychee Peach Yakult",
    oldPrice: 29000,
    price: 24000,
  },
  {
    id: "fore-sunny-citrus-jasmine",
    brand: "fore",
    group: "refresher",
    name: "Sunny Citrus Jasmine",
    oldPrice: 31000,
    price: 25500,
  },
  {
    id: "fore-coco-peach-fusion",
    brand: "fore",
    group: "refresher",
    name: "Coco Peach Fusion",
    oldPrice: 29000,
    price: 24000,
  },
  {
    id: "fore-caramel-praline-coffee-ice-blended",
    brand: "fore",
    group: "ice-blended",
    name: "Caramel Praline Coffee Ice Blended",
    oldPrice: 34000,
    price: 27750,
  },
  {
    id: "fore-matcha-ice-blended",
    brand: "fore",
    group: "ice-blended",
    name: "Matcha Ice Blended",
    oldPrice: 34000,
    price: 27750,
  },
  {
    id: "fore-strawberry-ice-blended",
    brand: "fore",
    group: "ice-blended",
    name: "Strawberry Ice Blended",
    oldPrice: 34000,
    price: 27750,
  },
  {
    id: "fore-chocolate-ice-blended",
    brand: "fore",
    group: "ice-blended",
    name: "Chocolate Ice Blended",
    oldPrice: 37000,
    price: 30000,
  },
  {
    id: "fore-english-breakfast",
    brand: "fore",
    group: "tea",
    name: "English Breakfast",
    oldPrice: 29000,
    price: 24000,
  },
  {
    id: "fore-green-tea-jasmine",
    brand: "fore",
    group: "tea",
    name: "Green Tea Jasmine",
    oldPrice: 29000,
    price: 24000,
  },
  {
    id: "fore-pure-chamomile",
    brand: "fore",
    group: "tea",
    name: "Pure Chamomile",
    oldPrice: 29000,
    price: 24000,
  },
  {
    id: "fore-green-tea-mint",
    brand: "fore",
    group: "tea",
    name: "Green Tea Mint",
    oldPrice: 29000,
    price: 24000,
  },
];

const PRODUCT_IMAGES_DATA = {
  "og-thai-tea": "menu_1.jpg",
  "thai-tea-loaded": "menu_2.jpg",
  "thai-tea-aren": "menu_3.jpg",
  "thai-tea-coffee": "menu_4.jpg",
  "thai-tea-coffee-coffee": "menu_4.jpg",
  "og-aren-speculoos-latte": "menu_14.jpg",
  "dua-shot-og-aren": "menu_15.jpg",
  "mocha-caramel": "menu_16.jpg",
  "cafe-malt-latte": "menu_19.jpg",
  "kopi-kenangan-mantan": "menu_20.jpg",
  "caramel-latte": "menu_21.jpg",
  "dua-shot-iced-shaken": "menu_22.jpg",
  "caramel-macchiato": "menu_23.jpg",
  "hazelnut-latte": "menu_24.jpg",
  "tiramisu-latte": "menu_25.jpg",
  "tiramisu-mocha-latte": "menu_26.jpg",
  "toffee-nut-latte": "menu_27.jpg",
  "toffee-nut-aren-latte": "menu_28.jpg",
  "toffee-nut-oat-latte": "menu_29.jpg",
  "pistachio-aren-latte": "menu_30.jpg",
  "kopi-susu-black-aren": "menu_31.jpg",
  "matcha-espresso": "menu_32.jpg",
  "mocha-latte": "menu_33.jpg",
  "vanilla-latte": "menu_34.jpg",
  "avocado-coffee": "menu_35.jpg",
  "spanish-latte": "menu_36.jpg",
  "creamy-aren-latte": "menu_37.jpg",
  "butterscotch-aren-latte": "menu_38.jpg",
  "butterscotch-sea-salt-latte": "menu_39.jpg",
  "americano": "menu_40.jpg",
  "cappuccino": "menu_41.jpg",
  "latte": "menu_42.jpg",
  "nc-og-thai-tea": "menu_49.jpg",
  "nc-thai-tea-loaded": "menu_50.jpg",
  "nc-thai-tea-aren": "menu_51.jpg",
  "og-aren-milky-speculoos": "menu_52.jpg",
  "choco-caramel": "menu_61.jpg",
  "toffee-nut-choco-macchiato": "menu_62.jpg",
  "butterscotch-sea-salt-macchiato": "menu_63.jpg",
  "milk-oreo-crumble": "menu_64.jpg",
  "babyccino": "menu_65.jpg",
  "fresh-lemonade": "menu_66.jpg",
  "lemon-black-tea": "menu_67.jpg",
  "kenangan-milk-tea": "menu_68.jpg",
  "milo-dinosaurus": "menu_69.jpg",
  "oreo-shake": "menu_70.jpg",
  "raspberry-hibiscus": "menu_71.jpg",
  "susu-grass-jelly": "menu_72.jpg",
  "matcha-latte": "menu_73.jpg",
  "hazelnut-choco-milk-tea": "menu_55.jpg",
  "avocado-caramel": "menu_56.jpg",
  "avocado-milk": "menu_57.jpg",
  "caramel-dutch-choco": "menu_58.jpg",
  "dutch-chocolate": "menu_59.jpg",
  "hazelnut-dutch-choco": "menu_60.jpg",
  "tiramisu-frappe": "menu_79.jpg",
  "butterscotch-kenangan-frappe": "menu_80.jpg",
  "matcha-kenangan-frappe": "menu_81.jpg",
  "kopi-kenangan-mantan-frappe": "menu_82.jpg",
  "vanilla-kenangan-frappe": "menu_83.jpg",
  "dutch-choco-kenangan-frappe": "menu_84.jpg",
  "canele-aren": "menu_93.jpg",
  "aren-apple-pie": "menu_94.jpg",
  "blueberry-muffin": "menu_95.jpg",
  "strawberry-choux-puff": "menu_96.jpg",
  "chocolate-choux-puff": "menu_103.jpg",
  "danish-tiramisu": "menu_104.jpg",
  "salt-bread-original": "menu_105.jpg",
  "canele-original": "menu_106.jpg",
  "canele-toffee-nut-crumble": "menu_107.jpg",
  "donut-almond": "menu_108.jpg",
  "roti-gulung-abon": "menu_99.jpg",
  "bambang-choco-cheese": "menu_109.jpg",
  "chocolate-croissant": "menu_115.jpg",
  "sugar-donut": "menu_116.jpg",
  "roti-coklat-klasik": "menu_117.jpg",
  "roti-keju-manis": "menu_118.jpg",
  "choco-chip-cookies": "menu_119.jpg",
  "join-the-dark-side-cookie": "menu_120.jpg",
  "friend-chip-cookie": "menu_119.jpg",
  "blueberry-americano": "menu_121.jpg",
  "blueberry-frappe": "menu_122.jpg",
  "chocoberry-frappe": "menu_123.jpg",
  "coffeeberry-frappe": "menu_124.jpg",
  "salt-bread-choco-butter": "menu_125.jpg",
  "salt-bread-sausage": "menu_126.jpg",
};
