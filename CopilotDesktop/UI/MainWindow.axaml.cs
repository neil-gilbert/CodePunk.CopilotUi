using System;
using Avalonia.Controls;
using Avalonia.Input;

namespace CodePunk.CopilotDesktop.UI;

public partial class MainWindow : Window
{
    public MainWindow()
    {
        InitializeComponent();
        this.FindControl<TextBox>("InputBox").AddHandler(KeyDownEvent, OnInputKeyDown, Avalonia.Interactivity.RoutingStrategies.Tunnel);
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
}

