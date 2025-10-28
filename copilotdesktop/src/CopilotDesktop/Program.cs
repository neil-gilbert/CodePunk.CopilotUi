using System;
using Avalonia;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using CodePunk.CopilotDesktop.Infrastructure;
using CodePunk.CopilotDesktop.Core;
using CodePunk.CopilotDesktop.UI;

namespace CodePunk.CopilotDesktop;

internal static class Program
{
    public static IHost? HostInstance { get; private set; }

    [STAThread]
    public static void Main(string[] args)
    {
        HostInstance = CreateHostBuilder(args).Build();
        BuildAvaloniaApp()
            .StartWithClassicDesktopLifetime(args);
        HostInstance.Dispose();
    }

    public static AppBuilder BuildAvaloniaApp()
        => AppBuilder.Configure<App>()
            .UsePlatformDetect()
            .LogToTrace();

    private static IHostBuilder CreateHostBuilder(string[] args) =>
        Microsoft.Extensions.Hosting.Host.CreateDefaultBuilder(args)
            .ConfigureLogging(logging =>
            {
                logging.ClearProviders();
                logging.AddConsole();
            })
            .ConfigureServices(services =>
            {
                services.AddSingleton<ICopilotProcessFactory, CopilotProcessFactory>();
                services.AddSingleton<ICopilotService, CopilotService>();
                services.AddSingleton<UI.ChatViewModel>();
                services.AddSingleton<UI.MainWindowViewModel>();
            });
}

