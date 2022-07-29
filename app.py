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

headers = {
    "accept": "application/json",
    "content-type": "application/json",
}
r = requests.post(url, json=query, headers=headers)
if r.status_code == 200:
    print(json.dumps(r.json()))
else:
    print('ERROR: HTTP {}'.format(r.status_code))
    print(r.text)
    r.raise_for_status()