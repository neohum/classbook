import os
import glob
import fitz  # PyMuPDF

BOOK_DIR = "d:/works/classbook/book"
IMAGES_DIR = os.path.join(BOOK_DIR, "images")

if not os.path.exists(IMAGES_DIR):
    os.makedirs(IMAGES_DIR)

pdf_files = glob.glob(os.path.join(BOOK_DIR, "*.pdf"))

for pdf_path in pdf_files:
    filename = os.path.basename(pdf_path)
    book_id = os.path.splitext(filename)[0]
    
    # Create a subfolder for each book
    book_image_dir = os.path.join(IMAGES_DIR, book_id)
    if not os.path.exists(book_image_dir):
        os.makedirs(book_image_dir)
        
    print(f"Processing: {filename}")
    doc = fitz.open(pdf_path)
    
    # For higher quality, use a Matrix
    # zoom_x = 2.0 (144 dpi), zoom_y = 2.0 (144 dpi)
    mat = fitz.Matrix(2.0, 2.0)
    
    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        pix = page.get_pixmap(matrix=mat)
        
        image_path = os.path.join(book_image_dir, f"page_{page_num + 1}.jpg")
        # Save only if it doesn't already exist to save time on re-runs
        if not os.path.exists(image_path):
            pix.save(image_path)
            
    # Also save page count for the frontend to know how many images to load
    with open(os.path.join(book_image_dir, "metadata.json"), "w", encoding="utf-8") as f:
        f.write(f'{{"numPages": {len(doc)}}}')

print("Conversion complete!")
