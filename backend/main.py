from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import uvicorn

app = FastAPI(
    title="Book Plus AI API",
    description="A FastAPI backend for the Book Plus AI application",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic models
class Book(BaseModel):
    id: Optional[int] = None
    title: str
    author: str
    description: Optional[str] = None
    isbn: Optional[str] = None
    published_year: Optional[int] = None

class BookCreate(BaseModel):
    title: str
    author: str
    description: Optional[str] = None
    isbn: Optional[str] = None
    published_year: Optional[int] = None

# In-memory storage (replace with database in production)
books_db = [
    {
        "id": 1,
        "title": "The Great Gatsby",
        "author": "F. Scott Fitzgerald",
        "description": "A story of the fabulously wealthy Jay Gatsby and his love for the beautiful Daisy Buchanan.",
        "isbn": "978-0743273565",
        "published_year": 1925
    },
    {
        "id": 2,
        "title": "To Kill a Mockingbird",
        "author": "Harper Lee",
        "description": "The story of young Scout Finch and her father Atticus in a racially divided Alabama town.",
        "isbn": "978-0446310789",
        "published_year": 1960
    }
]

@app.get("/")
async def root():
    return {"message": "Welcome to Book Plus AI API"}

@app.get("/api/books", response_model=List[Book])
async def get_books():
    """Get all books"""
    return books_db

@app.get("/api/books/{book_id}", response_model=Book)
async def get_book(book_id: int):
    """Get a specific book by ID"""
    for book in books_db:
        if book["id"] == book_id:
            return book
    raise HTTPException(status_code=404, detail="Book not found")

@app.post("/api/books", response_model=Book)
async def create_book(book: BookCreate):
    """Create a new book"""
    new_book = {
        "id": max([book["id"] for book in books_db]) + 1 if books_db else 1,
        **book.dict()
    }
    books_db.append(new_book)
    return new_book

@app.put("/api/books/{book_id}", response_model=Book)
async def update_book(book_id: int, book: BookCreate):
    """Update an existing book"""
    for i, existing_book in enumerate(books_db):
        if existing_book["id"] == book_id:
            updated_book = {"id": book_id, **book.dict()}
            books_db[i] = updated_book
            return updated_book
    raise HTTPException(status_code=404, detail="Book not found")

@app.delete("/api/books/{book_id}")
async def delete_book(book_id: int):
    """Delete a book"""
    for i, book in enumerate(books_db):
        if book["id"] == book_id:
            deleted_book = books_db.pop(i)
            return {"message": f"Book '{deleted_book['title']}' deleted successfully"}
    raise HTTPException(status_code=404, detail="Book not found")

@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "message": "API is running"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000) 