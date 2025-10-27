using System;
using System.Globalization;
using Avalonia.Data.Converters;

namespace CodePunk.CopilotDesktop.UI.Converters;

public sealed class EqualsConverter : IValueConverter
{
    public object? Convert(object? value, Type targetType, object? parameter, CultureInfo culture)
    {
        if (parameter is null) return false;
        return string.Equals(value?.ToString(), parameter.ToString(), StringComparison.OrdinalIgnoreCase);
    }

    public object? ConvertBack(object? value, Type targetType, object? parameter, CultureInfo culture)
        => throw new NotSupportedException();
}

