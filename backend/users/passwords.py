from django.contrib.auth.hashers import check_password, identify_hasher, make_password
from django.utils.crypto import constant_time_compare


def is_django_password_hash(value):
    if not value:
        return False
    try:
        identify_hasher(value)
    except ValueError:
        return False
    return True


def make_usuario_password(raw_password):
    return make_password(raw_password)


def set_usuario_password(usuario, raw_password, *, save=True):
    usuario.password_hash = make_usuario_password(raw_password)
    if save:
        usuario.save(update_fields=['password_hash'])
    return usuario.password_hash


def verify_usuario_password(usuario, raw_password):
    stored_password = usuario.password_hash
    if is_django_password_hash(stored_password):
        return check_password(raw_password, stored_password)

    if not constant_time_compare(stored_password or '', raw_password):
        return False

    # Compatibilidad temporal: una credencial legada correcta se actualiza
    # inmediatamente al formato seguro de Django.
    set_usuario_password(usuario, raw_password)
    return True
