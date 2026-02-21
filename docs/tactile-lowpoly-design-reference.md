# 🎨 Tactile LowPoly UI System — Design Reference Guide
> Light Theme · Copper Accent · Version 2:3

---

## ۱. پالت رنگی (Color Palette)

### رنگ‌های اصلی

| نام توکن | مقدار HEX | کاربرد |
|---|---|---|
| `--color-copper-primary` | `#A0522D` | دکمه‌های اصلی، اکسنت فعال |
| `--color-copper-hover` | `#8B4513` | حالت hover روی دکمه اصلی |
| `--color-copper-pressed` | `#7A3B10` | حالت pressed/loading |
| `--color-copper-light` | `#C97A50` | بج‌ها، تگ‌های برجسته، نوار پیشرفت |
| `--color-copper-muted` | `#D4956A` | حالت‌های secondary، لبه‌های ظریف |

### رنگ‌های سطح (Surface Tokens)

| نام توکن | مقدار HEX | کاربرد |
|---|---|---|
| `--surface-base` | `#F0EAE0` | پس‌زمینه اصلی صفحه |
| `--surface-raised` | `#EDE5D8` | کارت‌ها، المان‌های بالاآمده |
| `--surface-inset` | `#D6CBBA` | فیلدها، ورودی‌ها، فرورفتگی‌ها |
| `--surface-pressed` | `#C8BCAA` | حالت فشرده‌شده، کلیک |
| `--surface-white` | `#F5F0E8` | پس‌زمینه کارت‌های سفیدرنگ |

### رنگ‌های متن (Text Colors)

| نام توکن | مقدار HEX | کاربرد |
|---|---|---|
| `--text-primary` | `#3D2B1A` | متن اصلی، عنوان‌ها |
| `--text-secondary` | `#7A6050` | متن راهنما، برچسب‌ها |
| `--text-muted` | `#A08070` | placeholder، disabled |
| `--text-on-copper` | `#FFFFFF` | متن روی دکمه‌های مسی |
| `--text-error` | `#A0522D` | پیام‌های خطا |

### رنگ‌های وضعیت (State Colors)

| نام توکن | مقدار HEX | کاربرد |
|---|---|---|
| `--color-success` | `#5A8A5A` | پیام موفقیت، تیک |
| `--color-warning` | `#C87830` | هشدار، آیکون warning |
| `--color-error` | `#A04030` | خطا، border خطا |
| `--color-disabled-bg` | `#D8D0C4` | پس‌زمینه غیرفعال |
| `--color-disabled-text` | `#A89888` | متن غیرفعال |

---

## ۲. تایپوگرافی (Typography)

```
فونت اصلی: Sans-serif با ظاهر دست‌ساز/tactile
وزن‌ها: Regular (400) · Medium (500) · Bold (700)
```

| سطح | سایز | وزن | کاربرد |
|---|---|---|---|
| Display | 18–22px | Bold | عنوان سیستم، هدرهای اصلی |
| Heading | 14–16px | Bold | عناوین بخش‌ها (FOUNDATIONS، CONTROLS) |
| Label | 12–13px | Medium | برچسب فیلدها، تب‌ها |
| Body | 11–12px | Regular | متن توضیحات، list items |
| Caption | 10px | Regular | راهنماها، placeholder |
| Micro | 9px | Medium | بج‌ها، tooltip |

---

## ۳. سیستم سایه (Elevation System)

```css
/* Level 0 — Flat: بدون سایه */
box-shadow: none;

/* Level 1 — Low: المان‌های کوچک */
box-shadow: 2px 2px 4px rgba(160, 82, 45, 0.10);

/* Level 2 — Medium: کارت‌ها */
box-shadow: 4px 4px 8px rgba(160, 82, 45, 0.15);

/* Level 3 — High: دیالوگ‌ها */
box-shadow: 8px 8px 16px rgba(160, 82, 45, 0.20);

/* Level 4 — Floating: عملیات شناور */
box-shadow: 12px 12px 24px rgba(160, 82, 45, 0.25);
```

---

## ۴. گوشه‌گردی (Border Radius Scale)

```css
--radius-xs:  4px;   /* آیکون‌های کوچک */
--radius-sm:  8px;   /* دکمه‌ها، badge‌ها */
--radius-md: 12px;   /* فیلدها، کارت‌های کوچک */
--radius-lg: 16px;   /* کارت‌های بزرگ، modal */
--radius-xl: 22px;   /* المان‌های اصلی، panel */
--radius-full: 9999px; /* toggle، pill badge */
```

---

## ۵. ضخامت خط کناری (Border Thickness)

```css
--border-thin:   1px solid rgba(160, 82, 45, 0.20);
--border-normal: 2px solid rgba(160, 82, 45, 0.30);
--border-thick:  4px solid rgba(160, 82, 45, 0.40);
```

---

## ۶. آیکونوگرافی (Iconography Rules)

```css
/* اندازه‌های استاندارد */
--icon-sm: 16px;   /* آیکون‌های inline، کوچک */
--icon-md: 20px;   /* آیکون‌های ناوبری، دکمه */
--icon-lg: 24px;   /* آیکون‌های پروفایل، اصلی */

/* ضخامت stroke (line-based icons) */
stroke-width: 2px;
stroke-linecap: round;
stroke-linejoin: round;
fill: none; /* آیکون‌های outline */
```

---

## ۷. فاصله‌گذاری (Spacing Scale)

```css
--space-1:  4px;
--space-2:  8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
```

---

## ۸. المان‌های کنترلی (Controls)

### 🔘 دکمه‌ها (Buttons)

```css
/* PRIMARY */
.btn-primary {
  background: var(--color-copper-primary);
  color: #FFFFFF;
  border-radius: var(--radius-sm);
  padding: 10px 20px;
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  box-shadow: 3px 3px 6px rgba(160,82,45,0.35), 
              inset 0 1px 0 rgba(255,255,255,0.15);
  border: none;
}

/* PRESSED */
.btn-primary:active {
  background: var(--color-copper-pressed);
  box-shadow: inset 2px 2px 4px rgba(0,0,0,0.25);
  transform: translateY(1px);
}

/* DISABLED */
.btn-disabled {
  background: var(--color-disabled-bg);
  color: var(--color-disabled-text);
  border: 2px solid var(--color-disabled-text);
  box-shadow: none;
  cursor: not-allowed;
  border-radius: var(--radius-sm);
}
```

### 📝 فیلدهای ورودی (Text Fields)

```css
/* DEFAULT */
.input-field {
  background: var(--surface-inset);
  border: 1.5px solid rgba(160,82,45,0.20);
  border-radius: var(--radius-md);
  padding: 10px 14px;
  color: var(--text-primary);
  font-size: 12px;
  box-shadow: inset 2px 2px 4px rgba(0,0,0,0.08);
}

/* FOCUSED */
.input-field:focus {
  border-color: var(--color-copper-primary);
  box-shadow: inset 2px 2px 4px rgba(0,0,0,0.08),
              0 0 0 2px rgba(160,82,45,0.20);
  outline: none;
}

/* ERROR */
.input-field.error {
  border-color: var(--color-error);
  background: rgba(160,64,48,0.06);
}
```

### ☑️ Checkbox / Radio / Switch

```css
/* Checkbox — فعال */
.checkbox-checked {
  background: var(--color-copper-primary);
  border-radius: 4px;
  width: 20px; height: 20px;
  /* چک‌مارک سفید داخل */
}

/* Radio */
.radio {
  width: 20px; height: 20px;
  border-radius: 50%;
  border: 2px solid var(--surface-inset);
  background: var(--surface-raised);
  box-shadow: 2px 2px 4px rgba(0,0,0,0.12),
              inset 1px 1px 2px rgba(255,255,255,0.5);
}

/* Toggle Switch — ON */
.toggle-on {
  background: var(--color-copper-primary);
  border-radius: var(--radius-full);
  width: 44px; height: 24px;
}

/* Toggle Switch — OFF */
.toggle-off {
  background: var(--surface-inset);
  border-radius: var(--radius-full);
}
```

### 🎚️ Slider

```css
.slider-track {
  background: var(--surface-inset);
  height: 6px;
  border-radius: 3px;
  box-shadow: inset 1px 1px 3px rgba(0,0,0,0.15);
}

.slider-fill {
  background: var(--color-copper-primary);
  height: 6px;
  border-radius: 3px;
}

.slider-thumb {
  width: 20px; height: 20px;
  background: var(--color-copper-primary);
  border-radius: 50%;
  box-shadow: 2px 2px 5px rgba(160,82,45,0.4);
  /* tooltip بالای thumb نشان می‌دهد مقدار را */
}
```

---

## ۹. ناوبری (Navigation)

### تب‌ها (Tabs)

```css
.tab-active {
  background: var(--color-copper-primary);
  color: #FFFFFF;
  border-radius: var(--radius-sm);
  padding: 8px 16px;
  font-weight: 700;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tab-inactive {
  background: transparent;
  color: var(--text-secondary);
  padding: 8px 16px;
  font-size: 12px;
}
```

### Breadcrumb

```
HOME › PRODUCTS › ELECTRONICS › CURRENT ITEM
- جداکننده: ›
- رنگ لینک‌ها: copper-muted
- رنگ current: text-primary
- اندازه: 11px
```

### صفحه‌بندی (Pagination)

```css
.page-btn {
  width: 32px; height: 32px;
  border-radius: var(--radius-sm);
  background: var(--surface-raised);
  box-shadow: 2px 2px 5px rgba(0,0,0,0.12);
}

.page-btn.active {
  background: var(--color-copper-primary);
  color: white;
  box-shadow: inset 2px 2px 4px rgba(0,0,0,0.2);
}
```

---

## ۱۰. نمایش داده (Data Display)

### مراحل پردازش (Process Stepper)

```css
/* گام غیرفعال */
.step { 
  shape: polygon (lowpoly arrow);
  background: var(--surface-raised);
  color: var(--text-muted);
}

/* گام فعال */
.step.active {
  background: var(--color-copper-primary);
  color: white;
  font-weight: Bold;
}

/* متن راهنما */
.step-label { font-size: 10px; color: var(--text-secondary); }
```

### بج‌ها (Badges)

```css
.badge {
  background: var(--color-copper-light);
  color: white;
  border-radius: var(--radius-full);
  padding: 3px 8px;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
```

### آواتار (Avatars)

```css
.avatar {
  border-radius: 50%;
  border: 2px solid var(--color-copper-muted);
}

/* Avatar Placeholder (حرف اول) */
.avatar-initial {
  background: var(--color-copper-primary);
  color: white;
  font-weight: Bold;
  font-size: 13px;
}
```

### هدر جدول (Table Header)

```css
.table-header {
  background: var(--surface-raised);
  color: var(--text-secondary);
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1.5px solid var(--surface-inset);
  /* آیکون sort (▲▼) با رنگ copper */
}
```

---

## ۱۱. فیدبک (Feedback Components)

### Modal تأیید

```css
.modal {
  background: var(--surface-white);
  border-radius: var(--radius-xl);
  padding: 24px;
  box-shadow: 12px 12px 30px rgba(160,82,45,0.25);
  text-align: center;
}
/* دکمه CANCEL: secondary (مسی outline) */
/* دکمه DELETE/تأیید: primary (مسی solid) */
```

### Toast / اعلان‌ها

```css
.toast-success { border-left: 4px solid var(--color-success); }
.toast-warning { border-left: 4px solid var(--color-warning); }
.toast-error   { border-left: 4px solid var(--color-error);   }
/* پس‌زمینه همه: surface-raised با سایه Level 3 */
```

### Alert Banner

```css
.alert-banner {
  background: var(--color-copper-primary);
  color: white;
  padding: 10px 16px;
  font-size: 12px;
  border-radius: var(--radius-sm);
  /* کل عرض صفحه */
}
```

### نوار پیشرفت خطی (Linear Progress)

```css
.progress-track {
  background: var(--surface-inset);
  border-radius: var(--radius-full);
  height: 8px;
  box-shadow: inset 1px 1px 3px rgba(0,0,0,0.15);
}

.progress-fill {
  background: var(--color-copper-primary);
  border-radius: var(--radius-full);
  /* الگوی نواری (segmented) داخل fill */
}
```

### Spinner

```css
.spinner {
  width: 48px; height: 48px;
  border-radius: 50%;
  border: 5px solid var(--surface-inset);
  border-top-color: var(--color-copper-primary);
  /* شکل کمانی ناقص */
}
```

### Skeleton Rows

```css
.skeleton-row {
  background: linear-gradient(
    90deg,
    var(--surface-inset) 25%,
    var(--surface-raised) 50%,
    var(--surface-inset) 75%
  );
  border-radius: var(--radius-sm);
  height: 10px;
  /* انیمیشن shimmer */
}
```

### حالت خالی (Empty State)

```css
.empty-state {
  /* آیکون پوشه + ابر با رنگ copper-muted */
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
}

.empty-state-btn {
  /* دکمه ADD با استایل primary */
  margin-top: 12px;
}
```

---

## ۱۲. کارت‌ها و لیست‌ها (Cards & List Items)

### کارت

```css
.card {
  background: var(--surface-raised);
  border-radius: var(--radius-lg);
  padding: 16px;
  box-shadow: 4px 4px 10px rgba(160,82,45,0.15),
              inset 0 1px 0 rgba(255,255,255,0.4);
  overflow: hidden;
}

/* تصویر کارت */
.card-image {
  /* رنگ‌بندی lowpoly با گرادیان مثلثی */
  /* پالت: خاکی + مسی + نارنجی + بژ */
}

.card-cta {
  background: var(--color-copper-primary);
  color: white;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
}
```

### آیتم لیست

```css
.list-item {
  display: flex; align-items: center;
  padding: 10px 12px;
  background: var(--surface-raised);
  border-radius: var(--radius-md);
  margin-bottom: 4px;
  box-shadow: 2px 2px 5px rgba(0,0,0,0.08);
}

.list-item-arrow {
  color: var(--color-copper-muted);
  font-size: 16px;
}
```

---

## ۱۳. اصول استایل Tactile LowPoly

### قانون سایه‌های Neumorphic-Tactile

هر المان باید حس **سه‌بعدی و دست‌ساز** داشته باشد:
- المان‌های بالاآمده: سایه بیرونی تیره + هایلایت روشن در گوشه مقابل
- المان‌های فرورفته: سایه درونی (inset)
- پرهیز از تخت و بی‌روح بودن

### قانون LowPoly در تصاویر و آیکون‌ها

- تصاویر دکوراتیو با شبکه مثلثی (polygon mesh)
- پالت تصاویر: بژ، مسی، نارنجی خاکی، سفید خاکستری
- ابرها، کوه‌ها، پوشه‌ها با سبک چندضلعی

### قانون رنگ مسی (Copper Rule)

- **فقط یک رنگ اکسنت**: مسی (copper)
- استفاده از تن‌های مختلف همان مسی برای تمام حالت‌ها
- هیچ رنگ تند یا ناهماهنگ با پالت خاکی-گرم مجاز نیست

### قانون تایپوگرافی

- همه عنوان‌های بخش: **UPPERCASE + Bold**
- همه برچسب‌های کنترل: uppercase + medium
- متن محتوا: sentence case

---

## ۱۴. توکن‌های CSS کامل

```css
:root {
  /* Colors */
  --color-copper-primary:  #A0522D;
  --color-copper-hover:    #8B4513;
  --color-copper-pressed:  #7A3B10;
  --color-copper-light:    #C97A50;
  --color-copper-muted:    #D4956A;

  /* Surfaces */
  --surface-base:    #F0EAE0;
  --surface-raised:  #EDE5D8;
  --surface-inset:   #D6CBBA;
  --surface-pressed: #C8BCAA;
  --surface-white:   #F5F0E8;

  /* Text */
  --text-primary:    #3D2B1A;
  --text-secondary:  #7A6050;
  --text-muted:      #A08070;
  --text-on-copper:  #FFFFFF;
  --text-error:      #A0522D;

  /* States */
  --color-success: #5A8A5A;
  --color-warning: #C87830;
  --color-error:   #A04030;
  --color-disabled-bg:   #D8D0C4;
  --color-disabled-text: #A89888;

  /* Radius */
  --radius-xs:   4px;
  --radius-sm:   8px;
  --radius-md:  12px;
  --radius-lg:  16px;
  --radius-xl:  22px;
  --radius-full: 9999px;

  /* Spacing */
  --space-1:  4px;
  --space-2:  8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;

  /* Borders */
  --border-thin:   1px;
  --border-normal: 2px;
  --border-thick:  4px;

  /* Icons */
  --icon-sm: 16px;
  --icon-md: 20px;
  --icon-lg: 24px;
  --icon-stroke: 2px;
}
```

---

*این سند رفرنس کامل سیستم طراحی Tactile LowPoly - Light Theme - Copper Accent است.*  
*هر المان جدید باید از همین توکن‌ها و قوانین پیروی کند.*
