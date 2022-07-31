import json

import requests

url = "https://portal.cca.edu/search/people/_search"
query = {
    "query": {
        "simple_query_string": {
            # search term
            "query": "manager",
            "fields": [
                "full_name^5",
                "get_faculty_programs",
                "positions^5",
                "get_majors",
                "get_staff_departments",
                "username",
            ],
            "default_operator": "AND",
        }
    },
    # other filters are Faculty and Student
    "post_filter": {"term": {"usertype_filter": "Staff"}},
    "size": 60,
    "sort": [{"_score": "desc"}, {"get_last_name_filter": "asc"}],
}

def print_person(p):
    # some people don't have emails? but everyone has a username
    # @TODO filter to the right PM/Chair position in case someone has multiple
    # but no in the staff data does
    print(p["full_name"], p["username"] + '@cca.edu', p["positions"][0])
    # @TODO parse academic program out of positions string

headers = {
    "accept": "application/json",
    "content-type": "application/json",
}
r = requests.post(url, json=query, headers=headers)
if r.status_code == 200:
    data = r.json()
    for result in data["hits"]["hits"]:
        person = result["_source"]
        for position in person["positions"]:
            if "program manager" in position.lower() or "senior manager" in position.lower():
                print_person(person)
else:
    print('ERROR: HTTP {}'.format(r.status_code))
    print(r.text)
    r.raise_for_status()
