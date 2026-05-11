import pandas as pd


def nan_to_none(value):
    """
    Convert pandas-style NaN to Python None.

    pandas.DataFrame.agg() will coerce a None returned by a custom aggregator
    into NaN when the resulting column has float-compatible dtype. Pydantic
    Optional[str] fields then reject the NaN. This helper normalizes back.
    """
    if value is None:
        return None
    if isinstance(value, float) and pd.isna(value):
        return None
    return value
