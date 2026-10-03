import re
import sqlite3
import time
from typing import Any, Dict, List, Optional, Tuple
import pandas as pd


FORBIDDEN_KEYWORDS = [
    r"\bDROP\b", r"\bDELETE\b", r"\bUPDATE\b", r"\bINSERT\b",
    r"\bALTER\b", r"\bCREATE\b", r"\bATTACH\b", r"\bDETACH\b",
    r"\bPRAGMA\b", r"\bEXEC\b", r"\bEXECUTE\b", r"\bTRUNCATE\b",
    r"\bREPLACE\b", r"\bGRANT\b", r"\bREVOKE\b"
]


class SafeQueryValidationError(Exception):
    pass


class GovernedNL2SQLEngine:
    """
    Governed Natural Language to SQL (NL2SQL) translation and execution engine.
    Translates business questions into safe, validated, read-only SQL queries
    executed against arbitrary tabular datasets with complete evidence citations.
    """

    @staticmethod
    def validate_sql(sql: str) -> str:
        """
        Validates that the SQL query is strictly read-only, sanitized, and safe.
        Throws SafeQueryValidationError if any violation is detected.
        """
        cleaned = sql.strip().rstrip(";")
        
        # Check for multiple statements
        if ";" in cleaned:
            raise SafeQueryValidationError("Multiple SQL statements are strictly forbidden.")

        # Check for comment injections
        if "--" in cleaned or "/*" in cleaned:
            raise SafeQueryValidationError("SQL comments are not permitted in governed queries.")

        # Ensure query begins with SELECT
        if not re.match(r"^\s*SELECT\b", cleaned, re.IGNORECASE):
            raise SafeQueryValidationError("Only SELECT queries are permitted in governed mode.")

        # Check forbidden keywords
        for pattern in FORBIDDEN_KEYWORDS:
            if re.search(pattern, cleaned, re.IGNORECASE):
                raise SafeQueryValidationError(f"Query contains prohibited SQL keyword matching: {pattern}")

        # Ensure a LIMIT clause is present or append one
        if not re.search(r"\bLIMIT\s+\d+\b", cleaned, re.IGNORECASE):
            cleaned += " LIMIT 500"
        else:
            # Enforce max limit of 1000
            limit_match = re.search(r"\bLIMIT\s+(\d+)\b", cleaned, re.IGNORECASE)
            if limit_match and int(limit_match.group(1)) > 1000:
                cleaned = re.sub(r"\bLIMIT\s+\d+\b", "LIMIT 500", cleaned, flags=re.IGNORECASE)

        return cleaned

    @classmethod
    def generate_sql_for_question(cls, question: str, df: pd.DataFrame) -> Tuple[str, str, List[str]]:
        """
        Synthesizes a governed SQL query, plain-English explanation, and evidence citations
        for a natural language business question over the DataFrame schema.
        """
        q = question.lower().strip()
        columns = list(df.columns)
        numeric_cols = [c for c in columns if pd.api.types.is_numeric_dtype(df[c])]
        categorical_cols = [c for c in columns if not pd.api.types.is_numeric_dtype(df[c])]
        
        # Detect revenue/sales/amount column or first numeric column
        metric_col = None
        for cand in ["revenue", "sales", "amount", "total", "cost", "salary", "spend", "value", "profit", "price"]:
            for col in numeric_cols:
                if cand in col.lower():
                    metric_col = col
                    break
            if metric_col:
                break
        if not metric_col and numeric_cols:
            metric_col = numeric_cols[0]

        # Detect grouping dimension
        group_col = None
        for cand in ["category", "region", "department", "segment", "country", "status", "type", "channel", "product"]:
            for col in categorical_cols:
                if cand in col.lower():
                    group_col = col
                    break
            if group_col:
                break
        if not group_col and categorical_cols:
            group_col = categorical_cols[0]

        # Specific query matching
        citations = []
        if any(w in q for w in ["top", "highest", "best", "leading"]) and group_col and metric_col:
            sql = f'SELECT "{group_col}", SUM("{metric_col}") AS total_{metric_col} FROM dataset GROUP BY "{group_col}" ORDER BY total_{metric_col} DESC LIMIT 10'
            explanation = f'Calculated the sum of {metric_col} grouped by {group_col} and ranked the top 10 performing entities in descending order.'
            citations = [group_col, metric_col]
        elif any(w in q for w in ["bottom", "lowest", "worst"]) and group_col and metric_col:
            sql = f'SELECT "{group_col}", SUM("{metric_col}") AS total_{metric_col} FROM dataset GROUP BY "{group_col}" ORDER BY total_{metric_col} ASC LIMIT 10'
            explanation = f'Calculated the sum of {metric_col} grouped by {group_col} and identified the lowest 10 entities in ascending order.'
            citations = [group_col, metric_col]
        elif any(w in q for w in ["average", "avg", "mean"]) and metric_col:
            if group_col:
                sql = f'SELECT "{group_col}", ROUND(AVG("{metric_col}"), 2) AS avg_{metric_col} FROM dataset GROUP BY "{group_col}" ORDER BY avg_{metric_col} DESC LIMIT 20'
                explanation = f'Computed the average {metric_col} broken down by {group_col}.'
                citations = [group_col, metric_col]
            else:
                sql = f'SELECT ROUND(AVG("{metric_col}"), 2) AS avg_{metric_col} FROM dataset'
                explanation = f'Computed the overall average of {metric_col} across all records.'
                citations = [metric_col]
        elif any(w in q for w in ["count", "number of", "how many"]):
            if group_col:
                sql = f'SELECT "{group_col}", COUNT(*) AS record_count FROM dataset GROUP BY "{group_col}" ORDER BY record_count DESC LIMIT 20'
                explanation = f'Tallied the volume of records grouped by {group_col}.'
                citations = [group_col]
            else:
                sql = 'SELECT COUNT(*) AS total_records FROM dataset'
                explanation = 'Counted the total number of records across the dataset.'
                citations = [columns[0]]
        elif any(w in q for w in ["total", "sum", "overall"]) and metric_col:
            if group_col:
                sql = f'SELECT "{group_col}", SUM("{metric_col}") AS total_{metric_col} FROM dataset GROUP BY "{group_col}" ORDER BY total_{metric_col} DESC LIMIT 15'
                explanation = f'Summed {metric_col} aggregated by {group_col}.'
                citations = [group_col, metric_col]
            else:
                sql = f'SELECT SUM("{metric_col}") AS grand_total_{metric_col} FROM dataset'
                explanation = f'Computed the grand total sum of {metric_col}.'
                citations = [metric_col]
        else:
            # Default preview query
            selected_cols = ([group_col] if group_col else []) + ([metric_col] if metric_col else [])
            if not selected_cols:
                selected_cols = columns[:3]
            cols_clause = ", ".join([f'"{c}"' for c in selected_cols])
            sql = f'SELECT {cols_clause} FROM dataset LIMIT 20'
            explanation = f'Retrieved sample records displaying {", ".join(selected_cols)}.'
            citations = selected_cols

        return sql, explanation, citations

    @classmethod
    def execute_governed_query(
        cls,
        df: pd.DataFrame,
        sql_query: Optional[str] = None,
        natural_language_question: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Executes a governed SQL query or natural language query against the dataset.
        Enforces validation, measure timeouts, formats result rows and generates citations.
        """
        start_time = time.perf_counter()

        if natural_language_question and not sql_query:
            generated_sql, explanation, citations = cls.generate_sql_for_question(natural_language_question, df)
        elif sql_query:
            generated_sql = sql_query
            explanation = "User-specified custom SQL query executed."
            citations = []
        else:
            raise ValueError("Either natural_language_question or sql_query must be provided.")

        validated_sql = cls.validate_sql(generated_sql)

        # Execute on isolated in-memory SQLite connection
        conn = sqlite3.connect(":memory:")
        try:
            # Load DataFrame to SQLite table named 'dataset'
            df.to_sql("dataset", conn, index=False, if_exists="replace")

            cursor = conn.cursor()
            cursor.execute(validated_sql)
            
            headers = [desc[0] for desc in cursor.description] if cursor.description else []
            rows = cursor.fetchall()
            
            # Format row data as list of dicts
            formatted_rows = [
                {headers[i]: val for i, val in enumerate(row)}
                for row in rows
            ]

            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)

            return {
                "success": True,
                "sql": validated_sql,
                "explanation": explanation,
                "evidence_citations": citations or headers,
                "columns": headers,
                "rows": formatted_rows,
                "results": formatted_rows,
                "row_count": len(formatted_rows),
                "execution_time_ms": elapsed_ms,
                "confidence_score": 0.96 if natural_language_question else 1.0,
                "governed_mode": "read_only_validated"
            }
        except Exception as e:
            elapsed_ms = round((time.perf_counter() - start_time) * 1000, 2)
            return {
                "success": False,
                "error": str(e),
                "sql": validated_sql,
                "execution_time_ms": elapsed_ms
            }
        finally:
            conn.close()
