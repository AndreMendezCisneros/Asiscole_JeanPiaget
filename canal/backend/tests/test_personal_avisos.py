"""Textos de los avisos del personal para la Promotoría (sin BD)."""

from apps.ingesta.personal import es_evento_personal, redactar


def test_reconoce_eventos_personal():
    assert es_evento_personal("personal_entrada")
    assert not es_evento_personal("entrada")


def test_entrada_tarde_incluye_hora_esperada():
    texto = redactar(
        "personal_entrada",
        {"nombre_completo": "PEREZ, Ana", "categoria": "Administrativo", "hora": "07:05:00",
         "hora_esperada": "07:00:00", "estado": "Tarde"},
    )
    assert "07:05" in texto and "(07:00)" in texto and "tardanza" in texto


def test_falta_del_cierre():
    texto = redactar("personal_entrada", {"nombre_completo": "PEREZ, Ana", "fecha": "2026-10-26", "estado": "Falta"})
    assert "26/10/2026" in texto and "inasistencia" in texto


def test_salida_anticipada():
    texto = redactar(
        "personal_salida",
        {"nombre_completo": "PEREZ, Ana", "hora": "12:00", "tipo_salida": "Anticipada", "hora_salida_esperada": "13:00"},
    )
    assert "antes de su hora de salida (13:00), sin autorización" in texto


def test_incidencia_grave():
    texto = redactar(
        "personal_incidencia",
        {"nombre_completo": "PEREZ, Ana", "nombre_falta": "Falta", "es_grave": True, "observaciones": "Sin aviso"},
    )
    assert "incidencia grave" in texto and "Observaciones: Sin aviso" in texto


def test_llego_despues_de_su_salida():
    texto = redactar(
        "personal_entrada",
        {"nombre_completo": "PEREZ, Ana", "hora": "15:40", "hora_salida_esperada": "15:30", "estado": "Falta"},
    )
    assert "después de su hora de salida (15:30)" in texto and "inasistencia" in texto
