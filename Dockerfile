FROM python:3.12-slim

WORKDIR /app

ENV VIRTUAL_ENV=/app/.venv
ENV PATH="/app/.venv/bin:$PATH"

COPY pyproject.toml ./
RUN pip install --no-cache-dir uv \
  && uv sync --no-cache \
  && rm -rf /root/.cache

COPY app /app/app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
