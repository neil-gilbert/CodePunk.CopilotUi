using System;
using Avalonia.Controls;
using Avalonia.Input;
using Avalonia.Interactivity;
using Avalonia.Markup.Xaml;

namespace CodePunk.CopilotDesktop.UI;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        AvaloniaXamlLoader.Load(this);
    }

    private void OnInputKeyDown(object? sender, KeyEventArgs e)
    {
        if (e.Key == Key.Enter && !e.KeyModifiers.HasFlag(KeyModifiers.Shift))
        {
            if (DataContext is MainWindowViewModel vm && vm.Chat.SendCommand.CanExecute(null))
            {
                vm.Chat.SendCommand.Execute(null);
                e.Handled = true;
            }
        }
    }
    
    private void OnClearHistory(object? sender, RoutedEventArgs e)
    {
        if (DataContext is MainWindowViewModel vm)
        {
            vm.ClearHistory();
        }
    }
}

