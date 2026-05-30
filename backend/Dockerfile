FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends gcc libpq-dev && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p uploads logs

EXPOSE 3000

# Migration + server birga ishga tushadi
CMD ["sh", "-c", "alembic upgrade head && uvicorn main:socket_app --host 0.0.0.0 --port 3000 --workers 1"]
