# Uso del Componente ErrorDialog

El componente `ErrorDialog` proporciona una interfaz visual moderna y consistente para mostrar errores, advertencias e información al usuario.

## Características

- Diseño moderno con iconos visuales
- Variantes: `error`, `warning`, `info`
- Botón de acción personalizable
- Animaciones suaves
- Fácil de integrar con el hook `useErrorDialog`

## Instalación

El componente ya está disponible en:
- `src/components/ui/error-dialog.tsx`
- `src/hooks/useErrorDialog.ts`

## Uso Básico

### Opción 1: Usando el Hook `useErrorDialog` (Recomendado)

```tsx
import { ErrorDialog } from '@/components/ui/error-dialog';
import { useErrorDialog } from '@/hooks/useErrorDialog';

export const MiComponente = () => {
  const { errorDialog, showError, showAuthError, showWarning, showInfo, closeError } = useErrorDialog();

  const handleAction = async () => {
    try {
      // ... tu código
    } catch (error) {
      showError('Ocurrió un error al procesar la solicitud', 'Error');
    }
  };

  return (
    <div>
      {/* Tu contenido */}
      
      <ErrorDialog
        open={errorDialog.open}
        onOpenChange={(open) => !open && closeError()}
        title={errorDialog.title}
        message={errorDialog.message}
        buttonText="OK"
        variant={errorDialog.variant}
      />
    </div>
  );
};
```

### Opción 2: Uso Directo del Componente

```tsx
import { ErrorDialog } from '@/components/ui/error-dialog';
import { useState } from 'react';

export const MiComponente = () => {
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleError = (message: string) => {
    setErrorMessage(message);
    setErrorOpen(true);
  };

  return (
    <div>
      {/* Tu contenido */}
      
      <ErrorDialog
        open={errorOpen}
        onOpenChange={setErrorOpen}
        title="Error"
        message={errorMessage}
        buttonText="OK"
        variant="error"
      />
    </div>
  );
};
```

## Métodos del Hook

### `showError(message, title?, variant?)`
Muestra un error genérico.

```tsx
showError('No se pudo guardar el registro', 'Error al Guardar', 'error');
```

### `showAuthError(message?)`
Muestra un error de autenticación con título predefinido.

```tsx
showAuthError('Credenciales inválidas');
// O con mensaje por defecto
showAuthError();
```

### `showWarning(message, title?)`
Muestra una advertencia.

```tsx
showWarning('Esta acción no se puede deshacer', 'Advertencia');
```

### `showInfo(message, title?)`
Muestra información.

```tsx
showInfo('Los cambios se guardaron correctamente', 'Información');
```

## Variantes

- **`error`** (por defecto): Círculo rojo con X, botón morado
- **`warning`**: Círculo amarillo con X, botón amarillo
- **`info`**: Círculo azul con X, botón azul

## Props del Componente

| Prop | Tipo | Requerido | Default | Descripción |
|------|------|-----------|---------|-------------|
| `open` | `boolean` | Sí | - | Controla si el diálogo está abierto |
| `onOpenChange` | `(open: boolean) => void` | Sí | - | Callback cuando cambia el estado |
| `message` | `string` | Sí | - | Mensaje a mostrar |
| `title` | `string` | No | `'Error'` | Título del diálogo |
| `buttonText` | `string` | No | `'OK'` | Texto del botón |
| `onConfirm` | `() => void` | No | - | Callback al hacer clic en OK |
| `variant` | `'error' \| 'warning' \| 'info'` | No | `'error'` | Variante visual |

## Ejemplos de Uso

### Ejemplo 1: Error de Autenticación (Login)

```tsx
const { errorDialog, showAuthError, closeError } = useErrorDialog();

const handleLogin = async () => {
  const { error } = await authService.login(username, password);
  if (error) {
    showAuthError(error);
  }
};

// En el JSX:
<ErrorDialog
  open={errorDialog.open}
  onOpenChange={(open) => !open && closeError()}
  title={errorDialog.title}
  message={errorDialog.message}
  buttonText="OK"
  variant={errorDialog.variant}
/>
```

### Ejemplo 2: Error al Guardar

```tsx
const { errorDialog, showError, closeError } = useErrorDialog();

const handleSave = async () => {
  try {
    await saveData();
  } catch (error) {
    showError('No se pudo guardar el registro. Intente nuevamente.', 'Error al Guardar');
  }
};
```

### Ejemplo 3: Advertencia antes de Eliminar

```tsx
const { errorDialog, showWarning, closeError } = useErrorDialog();

const handleDelete = () => {
  showWarning('Esta acción eliminará permanentemente el registro. ¿Está seguro?', 'Confirmar Eliminación');
};
```

## Componentes que ya lo usan

- ✅ `Login.tsx` - Errores de autenticación
- ✅ `RegisterIncident.tsx` - Errores al registrar incidencias

## Notas

- El diálogo se cierra automáticamente al hacer clic en el botón OK
- El diálogo también se puede cerrar haciendo clic fuera de él (si `onOpenChange` lo permite)
- El botón de cerrar (X) en la esquina superior derecha está oculto por diseño
- Los colores y estilos están optimizados para accesibilidad

