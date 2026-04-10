"""
City normalization for detailer matching.

Maps locality/suburb/neighborhood names to main city names so that
client addresses in areas like Ballentree Village (Dublin) correctly
match detailers registered in Dublin.
"""

# Maps locality/suburb names (lowercase) to main city for matching
# Add entries as needed when new mismatches are discovered
CITY_NORMALIZATION = {
    # Ireland - Dublin area
    "ballentree village": "dublin",
    "south dublin": "dublin",
    "dún laoghaire-rathdown": "dublin",
    "dun laoghaire-rathdown": "dublin",
    "fingal": "dublin",
    "dublin city": "dublin",
    "county dublin": "dublin",
    "ranelagh": "dublin",
    "rathmines": "dublin",
    "ballsbridge": "dublin",
    "sandymount": "dublin",
    "clontarf": "dublin",
    "phibsborough": "dublin",
    "drimnagh": "dublin",
    "crumlin": "dublin",
    "tallaght": "dublin",
    "blanchardstown": "dublin",
    "swords": "dublin",
    "dún laoghaire": "dublin",
    "dun laoghaire": "dublin",
}


def normalize_city_for_matching(city: str) -> str:
    """
    Normalize a city name for detailer matching.

    Maps localities/neighborhoods to their main city (e.g. Ballentree Village -> Dublin).
    Returns the normalized city if a mapping exists, otherwise returns the original city.

    Args:
        city: Raw city name from address (e.g. from Google Places locality)

    Returns:
        Normalized city name for matching against detailer records
    """
    if not city or not isinstance(city, str):
        return city or ""
    normalized = city.strip().lower()
    return CITY_NORMALIZATION.get(normalized, city.strip())
