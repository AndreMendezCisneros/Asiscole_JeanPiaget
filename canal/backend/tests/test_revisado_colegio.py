from apps.mensajeria.revisado_colegio import (
    id_incidencia_desde_mensaje,
    ids_incidencia_por_tenant,
)


def test_id_incidencia_desde_origen_evento():
    assert (
        id_incidencia_desde_mensaje(
            tipo="incidencia",
            origen_evento="incidencia:9",
        )
        == 9
    )


def test_id_incidencia_ignora_entrada():
    assert (
        id_incidencia_desde_mensaje(
            tipo="entrada",
            origen_evento="entrada:1",
        )
        is None
    )


def test_id_incidencia_desde_metadata():
    assert (
        id_incidencia_desde_mensaje(
            tipo="incidencia",
            origen_evento="",
            metadata={"id_registro": 12},
        )
        == 12
    )


def test_agrupa_por_tenant_sin_duplicados():
    agrupados = ids_incidencia_por_tenant(
        [
            {
                "tenant_id": "asis_academy",
                "tipo": "incidencia",
                "origen_evento": "incidencia:8",
            },
            {
                "tenant_id": "asis_academy",
                "tipo": "incidencia",
                "origen_evento": "incidencia:8",
            },
            {
                "tenant_id": "asis_academy",
                "tipo": "entrada",
                "origen_evento": "entrada:1",
            },
            {
                "tenant_id": "jean_piaget",
                "tipo": "incidencia",
                "origen_evento": "incidencia:55",
            },
        ]
    )
    assert agrupados == {
        "asis_academy": [8],
        "jean_piaget": [55],
    }
