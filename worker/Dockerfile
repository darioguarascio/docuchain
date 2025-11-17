FROM python:3.12-slim

WORKDIR /app

# Copy requirements file first for better layer caching
# Dependencies will only be reinstalled if requirements.txt changes
COPY requirements.txt .

# Install Python dependencies (cached unless requirements.txt changes)
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code last (this changes most frequently)
COPY . .

CMD ["python", "worker.py"]

