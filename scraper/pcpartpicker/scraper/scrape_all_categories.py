import json
import os
import re
from datetime import datetime
from dotenv import load_dotenv
from firecrawl import FirecrawlApp

# Load environment variables
load_dotenv()

def extract_product_name_and_url(name_cell):
    """Extract product name and URL from the name cell (common pattern across all categories)"""
    # Extract URL - it's in the last markdown link
    url_match = re.search(r']\((https://pcpartpicker\.com/product/[^\)]+)\)\s*$', name_cell)
    url = url_match.group(1) if url_match else ''

    # Extract product name - pattern: \<br>\<br>Product Name\<br>\<br>(rating)
    name_match = re.search(r'\\<br>\\<br>([^\\]+)\\<br>\\<br>\(\d+\)', name_cell)
    if name_match:
        name = name_match.group(1).strip()
    else:
        # Fallback: try to extract from alt text
        alt_match = re.search(r'\!\[([^\]]+)\]', name_cell)
        name = alt_match.group(1) if alt_match else ''

    # Extract rating from name cell
    rating_match = re.search(r'\((\d+)\)', name_cell)
    rating = rating_match.group(1) if rating_match else ''

    return name, url, rating

def clean_cell_value(cell):
    """Clean cell value by removing headers and line breaks"""
    value = cell.split('\n')[-1].strip() if '\n' in cell else cell.strip()
    value = re.sub(r'^#+ [^\n]*\n', '', value)
    value = re.sub(r'^#+ [^\n<]*<br>', '', value)
    value = re.sub(r'<br>|\\<br>', '', value).strip()
    return value

def parse_cpu_table(markdown, debug=False):
    """Parse CPU products from markdown table"""
    products = []
    lines = markdown.split('\n')
    table_started = False

    for i, line in enumerate(lines):
        if '| Name | Core Count |' in line or '|  | Name | Core Count |' in line:
            table_started = True
            continue

        if not table_started or not line.strip().startswith('|'):
            if table_started and len(products) > 0:
                break
            continue

        if '| ---' in line:
            continue

        parts = [p.strip() for p in line.split('|')]
        if len(parts) < 11:
            continue

        try:
            name, url, rating = extract_product_name_and_url(parts[2])

            # Extract price
            price_match = re.search(r'\$[\d,]+\.?\d*', parts[10])
            price = price_match.group(0) if price_match else ''

            product = {
                'name': name,
                'url': url,
                'core_count': clean_cell_value(parts[3]),
                'performance_core_clock': clean_cell_value(parts[4]),
                'performance_core_boost_clock': clean_cell_value(parts[5]),
                'microarchitecture': clean_cell_value(parts[6]),
                'tdp': clean_cell_value(parts[7]),
                'integrated_graphics': clean_cell_value(parts[8]),
                'rating': rating,
                'price': price
            }

            if product['name'] and product['price']:
                products.append(product)

        except Exception as e:
            if debug:
                print(f"Error parsing CPU row: {e}")
            continue

    return products

def parse_motherboard_table(markdown, debug=False):
    """Parse Motherboard products from markdown table"""
    products = []
    lines = markdown.split('\n')
    table_started = False

    for i, line in enumerate(lines):
        if '| Name | Socket / CPU |' in line or '|  | Name | Socket / CPU |' in line:
            table_started = True
            continue

        if not table_started or not line.strip().startswith('|'):
            if table_started and len(products) > 0:
                break
            continue

        if '| ---' in line:
            continue

        parts = [p.strip() for p in line.split('|')]
        if len(parts) < 10:
            continue

        try:
            name, url, rating = extract_product_name_and_url(parts[2])

            price_match = re.search(r'\$[\d,]+\.?\d*', parts[9])
            price = price_match.group(0) if price_match else ''

            product = {
                'name': name,
                'url': url,
                'socket_cpu': clean_cell_value(parts[3]),
                'form_factor': clean_cell_value(parts[4]),
                'memory_max': clean_cell_value(parts[5]),
                'memory_slots': clean_cell_value(parts[6]),
                'color': clean_cell_value(parts[7]),
                'rating': rating,
                'price': price
            }

            if product['name'] and product['price']:
                products.append(product)

        except Exception as e:
            if debug:
                print(f"Error parsing Motherboard row: {e}")
            continue

    return products

def parse_storage_table(markdown, debug=False):
    """Parse Storage products from markdown table"""
    products = []
    lines = markdown.split('\n')
    table_started = False

    for i, line in enumerate(lines):
        if '| Name | Capacity |' in line or '|  | Name | Capacity |' in line:
            table_started = True
            continue

        if not table_started or not line.strip().startswith('|'):
            if table_started and len(products) > 0:
                break
            continue

        if '| ---' in line:
            continue

        parts = [p.strip() for p in line.split('|')]
        if len(parts) < 11:
            continue

        try:
            name, url, rating = extract_product_name_and_url(parts[2])

            price_match = re.search(r'\$[\d,]+\.?\d*', parts[10])
            price = price_match.group(0) if price_match else ''

            product = {
                'name': name,
                'url': url,
                'capacity': clean_cell_value(parts[3]),
                'price_per_gb': clean_cell_value(parts[4]),
                'type': clean_cell_value(parts[5]),
                'cache': clean_cell_value(parts[6]),
                'form_factor': clean_cell_value(parts[7]),
                'interface': clean_cell_value(parts[8]),
                'rating': rating,
                'price': price
            }

            if product['name'] and product['price']:
                products.append(product)

        except Exception as e:
            if debug:
                print(f"Error parsing Storage row: {e}")
            continue

    return products

def parse_video_card_table(markdown, debug=False):
    """Parse Video Card products from markdown table"""
    products = []
    lines = markdown.split('\n')
    table_started = False

    for i, line in enumerate(lines):
        if '| Name | Chipset |' in line or '|  | Name | Chipset |' in line:
            table_started = True
            continue

        if not table_started or not line.strip().startswith('|'):
            if table_started and len(products) > 0:
                break
            continue

        if '| ---' in line:
            continue

        parts = [p.strip() for p in line.split('|')]
        if len(parts) < 11:
            continue

        try:
            name, url, rating = extract_product_name_and_url(parts[2])

            price_match = re.search(r'\$[\d,]+\.?\d*', parts[10])
            price = price_match.group(0) if price_match else ''

            product = {
                'name': name,
                'url': url,
                'chipset': clean_cell_value(parts[3]),
                'memory': clean_cell_value(parts[4]),
                'core_clock': clean_cell_value(parts[5]),
                'boost_clock': clean_cell_value(parts[6]),
                'color': clean_cell_value(parts[7]),
                'length': clean_cell_value(parts[8]),
                'rating': rating,
                'price': price
            }

            if product['name'] and product['price']:
                products.append(product)

        except Exception as e:
            if debug:
                print(f"Error parsing Video Card row: {e}")
            continue

    return products

def parse_case_table(markdown, debug=False):
    """Parse Case products from markdown table"""
    products = []
    lines = markdown.split('\n')
    table_started = False

    for i, line in enumerate(lines):
        if '| Name | Type |' in line or '|  | Name | Type |' in line:
            table_started = True
            continue

        if not table_started or not line.strip().startswith('|'):
            if table_started and len(products) > 0:
                break
            continue

        if '| ---' in line:
            continue

        parts = [p.strip() for p in line.split('|')]
        if len(parts) < 11:
            continue

        try:
            name, url, rating = extract_product_name_and_url(parts[2])

            price_match = re.search(r'\$[\d,]+\.?\d*', parts[10])
            price = price_match.group(0) if price_match else ''

            product = {
                'name': name,
                'url': url,
                'type': clean_cell_value(parts[3]),
                'color': clean_cell_value(parts[4]),
                'power_supply': clean_cell_value(parts[5]),
                'side_panel': clean_cell_value(parts[6]),
                'external_volume': clean_cell_value(parts[7]),
                'internal_bays': clean_cell_value(parts[8]),
                'rating': rating,
                'price': price
            }

            if product['name'] and product['price']:
                products.append(product)

        except Exception as e:
            if debug:
                print(f"Error parsing Case row: {e}")
            continue

    return products

def parse_power_supply_table(markdown, debug=False):
    """Parse Power Supply products from markdown table"""
    products = []
    lines = markdown.split('\n')
    table_started = False

    for i, line in enumerate(lines):
        if '| Name | Type |' in line and 'Efficiency Rating' in line:
            table_started = True
            continue

        if not table_started or not line.strip().startswith('|'):
            if table_started and len(products) > 0:
                break
            continue

        if '| ---' in line:
            continue

        parts = [p.strip() for p in line.split('|')]
        if len(parts) < 10:
            continue

        try:
            name, url, rating = extract_product_name_and_url(parts[2])

            price_match = re.search(r'\$[\d,]+\.?\d*', parts[9])
            price = price_match.group(0) if price_match else ''

            product = {
                'name': name,
                'url': url,
                'type': clean_cell_value(parts[3]),
                'efficiency_rating': clean_cell_value(parts[4]),
                'wattage': clean_cell_value(parts[5]),
                'modular': clean_cell_value(parts[6]),
                'color': clean_cell_value(parts[7]),
                'rating': rating,
                'price': price
            }

            if product['name'] and product['price']:
                products.append(product)

        except Exception as e:
            if debug:
                print(f"Error parsing Power Supply row: {e}")
            continue

    return products

def parse_cpu_cooler_table(markdown, debug=False):
    """Parse CPU Cooler products from markdown table"""
    products = []
    lines = markdown.split('\n')
    table_started = False

    for i, line in enumerate(lines):
        if '| Name | Fan RPM |' in line or '|  | Name | Fan RPM |' in line:
            table_started = True
            continue

        if not table_started or not line.strip().startswith('|'):
            if table_started and len(products) > 0:
                break
            continue

        if '| ---' in line:
            continue

        parts = [p.strip() for p in line.split('|')]
        if len(parts) < 9:
            continue

        try:
            name, url, rating = extract_product_name_and_url(parts[2])

            price_match = re.search(r'\$[\d,]+\.?\d*', parts[8])
            price = price_match.group(0) if price_match else ''

            product = {
                'name': name,
                'url': url,
                'fan_rpm': clean_cell_value(parts[3]),
                'noise_level': clean_cell_value(parts[4]),
                'color': clean_cell_value(parts[5]),
                'radiator_size': clean_cell_value(parts[6]),
                'rating': rating,
                'price': price
            }

            if product['name'] and product['price']:
                products.append(product)

        except Exception as e:
            if debug:
                print(f"Error parsing CPU Cooler row: {e}")
            continue

    return products

def scrape_category(app, category_name, category_path, parser_func, max_products=500):
    """Generic function to scrape any category with pagination"""
    base_url = f"https://pcpartpicker.com{category_path}"
    all_products = []
    page = 1

    print(f"\n{'='*80}")
    print(f"Scraping {category_name} (up to {max_products} products)...")
    print(f"{'='*80}\n")

    while len(all_products) < max_products:
        url = base_url if page == 1 else f"{base_url}#page={page}"
        print(f"Page {page}: Scraping {url}...")

        try:
            result = app.scrape(
                url=url,
                formats=['markdown'],
                location={
                    'country': 'US',
                    'languages': ['en']
                },
                actions=[
                    {"type": "wait", "milliseconds": 5000}
                ]
            )

            markdown = result.markdown if hasattr(result, 'markdown') else ''
            page_products = parser_func(markdown, debug=False)

            if not page_products:
                print(f"  No products found on page {page}. Stopping.")
                break

            print(f"  Found {len(page_products)} products")
            all_products.extend(page_products)

            if len(all_products) >= max_products:
                print(f"  Reached target of {max_products} products. Stopping.")
                break

            page += 1

        except Exception as e:
            print(f"  Error scraping page {page}: {e}")
            break

    # Limit to max_products
    all_products = all_products[:max_products]

    # Save to file
    os.makedirs('scraped_data', exist_ok=True)
    output_file = f'scraped_data/{category_name.lower().replace(" ", "_")}_products.json'
    output_data = {
        'category': category_name.lower().replace(" ", "_"),
        'base_url': base_url,
        'pages_scraped': page,
        'scraped_at': datetime.now().isoformat(),
        'product_count': len(all_products),
        'products': all_products
    }

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)

    print(f"\n{'='*60}")
    print(f"Total {category_name} products: {len(all_products)}")
    print(f"Pages scraped: {page}")
    print(f"Data saved to {output_file}")
    print(f"{'='*60}")

    if all_products:
        print(f"\nSample {category_name} products:")
        for i in range(min(3, len(all_products))):
            print(f"\n{i+1}. {all_products[i]['name']}")
            print(f"   Price: {all_products[i]['price']}")
            print(f"   Rating: {all_products[i]['rating']}")

    return output_data

def scrape_all_categories():
    """Scrape all PC Part Picker categories"""
    # Initialize Firecrawl
    api_key = os.getenv('FIRECRAWL_API_KEY')
    if not api_key:
        raise ValueError("FIRECRAWL_API_KEY not found in .env file")

    app = FirecrawlApp(api_key=api_key)

    # Define categories and their parsers
    categories = {
        "CPU": ("/products/cpu/", parse_cpu_table),
        "Motherboard": ("/products/motherboard/", parse_motherboard_table),
        "Storage": ("/products/internal-hard-drive/", parse_storage_table),
        "Video Card": ("/products/video-card/", parse_video_card_table),
        "Case": ("/products/case/", parse_case_table),
        "Power Supply": ("/products/power-supply/", parse_power_supply_table),
        "CPU Cooler": ("/products/cpu-cooler/", parse_cpu_cooler_table)
    }

    results = {}
    start_time = datetime.now()

    print("\n" + "="*80)
    print("PC PART PICKER MULTI-CATEGORY SCRAPER")
    print("="*80)
    print(f"Start time: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Categories to scrape: {len(categories)}")
    print(f"Products per category: 500")
    print("="*80)

    # Scrape each category
    for category_name, (category_path, parser_func) in categories.items():
        try:
            result = scrape_category(app, category_name, category_path, parser_func, max_products=500)
            results[category_name] = result
        except Exception as e:
            print(f"\nError scraping {category_name}: {e}")
            import traceback
            traceback.print_exc()

    # Print final summary
    end_time = datetime.now()
    duration = end_time - start_time

    print("\n" + "="*80)
    print("SCRAPING COMPLETE - SUMMARY")
    print("="*80)
    print(f"End time: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Duration: {duration}")
    print(f"\nResults:")

    total_products = 0
    for category_name, result in results.items():
        count = result['product_count']
        total_products += count
        print(f"  {category_name}: {count} products")

    print(f"\nTotal products scraped: {total_products}")
    print("="*80)

    return results

if __name__ == "__main__":
    try:
        results = scrape_all_categories()
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
