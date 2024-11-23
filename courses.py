import json

import requests

url = "https://portal.cca.edu/search/courses/_search"
headers = {
    "accept": "application/json",
    "content-type": "application/json",
}
query = {
    # "query": {
    #     "simple_query_string": {
    #         "query": "SEARCH TEXT HERE",
    #         "fields": [
    #             "title^2",
    #             "section_code",
    #             "get_section_description",
    #             "_get_instructors",
    #             "get_subject"
    #         ]
    #     }
    # },
    "post_filter": {
        "term": {
            "get_term_filter": "Spring 2025"
        }
    },
    "size": 10,
    "suggest": {
        "text": "",
        "suggestions": {
            "phrase": {
                "field": "get_section_description",
                "real_word_error_likelihood": 0.95,
                "max_errors": 1,
                "gram_size": 4,
                "direct_generator": [
                    {
                        "field": "get_section_description",
                        "suggest_mode": "always",
                        "min_word_length": 1
                    }
                ]
            }
        }
    },
    "sort": [
        {
            "_score": "desc"
        },
        {
            "get_subject_filter": "asc"
        },
        {
            "get_course_number_filter": "asc"
        },
        {
            "section_number_filter": "asc"
        }
    ]
}
r = requests.post(url, json=query, headers=headers)
r.raise_for_status()
data = r.json()
print(json.dumps(data, indent=2))
