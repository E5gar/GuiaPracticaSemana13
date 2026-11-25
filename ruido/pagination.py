from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class PaginacionEstandar(PageNumberPagination):
    page_size = 12
    page_size_query_param = 'page_size'
    max_page_size = 100

    def get_paginated_response(self, data):
        return Response({
            'count': self.page.paginator.count,
            'total_paginas': self.page.paginator.num_pages,
            'pagina_actual': self.page.number,
            'next': self.get_next_link(),
            'previous': self.get_previous_link(),
            'results': data,
        })

    def get_paginated_response_schema(self, schema):
        return {
            'type': 'object',
            'required': ['count', 'results'],
            'properties': {
                'count': {'type': 'integer', 'example': 240},
                'total_paginas': {'type': 'integer', 'example': 20},
                'pagina_actual': {'type': 'integer', 'example': 1},
                'next': {'type': 'string', 'nullable': True, 'format': 'uri'},
                'previous': {'type': 'string', 'nullable': True, 'format': 'uri'},
                'results': schema,
            },
        }